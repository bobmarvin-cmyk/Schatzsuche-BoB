-- SCHATZSUCHE ONLINE V6.27
-- MASCHINEN = VIRTUELLE SUCHE
-- Nach V6.26 / V6.26.1 EINMAL ausführen.
--
-- Maschinen decken KEINE explored_fields mehr auf.
-- machine_auto_fields bedeutet ab jetzt "virtuelle Suchfelder pro Takt".
-- Trefferchance pro Takt:
--   min(1, Maschinenleistung * offene_schatzteile / verbleibende_unbekannte_felder)
-- Damit entspricht die Maschine näherungsweise einer zufälligen Suche über M Felder,
-- ohne diese Felder tatsächlich in der Datenbank anzufassen.

create or replace function public.run_machines_v613(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  gp public.game_players%rowtype;
  g public.games%rowtype;
  s public.platform_settings%rowtype;

  machine_power int:=0;
  interval_s int:=30;
  elapsed numeric:=0;
  last_machine_at timestamptz;

  total_fields bigint:=0;
  explored_fields_count bigint:=0;
  unknown_fields bigint:=0;
  open_treasures int:=0;

  hit_chance numeric:=0;
  roll numeric:=0;
  hit boolean:=false;

  target_treasure uuid;
  claim_id uuid;
  reserved_count int:=0;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  select * into gp
  from public.game_players
  where game_id=p_game_id
    and user_id=auth.uid();

  if not found then
    raise exception 'Nicht im Spiel';
  end if;

  select * into g
  from public.games
  where id=p_game_id;

  if not found or g.status<>'active' then
    return jsonb_build_object(
      'opened',0,
      'active',false
    );
  end if;

  if g.start_at is not null and g.start_at>now() then
    return jsonb_build_object(
      'opened',0,
      'active',true,
      'waiting_for_start',true,
      'seconds_to_start',
        greatest(1,ceil(extract(epoch from(g.start_at-now())))::int)
    );
  end if;

  select coalesce(sum(t.machine_auto_fields),0)::int
  into machine_power
  from public.player_technologies pt
  join public.technologies t
    on t.id=pt.technology_id
  where pt.game_id=p_game_id
    and pt.user_id=auth.uid()
    and t.is_active=true;

  if machine_power<=0 then
    return jsonb_build_object(
      'opened',0,
      'active',true,
      'machine_power',0
    );
  end if;

  select * into s
  from public.platform_settings
  where id=1;

  interval_s:=greatest(
    coalesce(s.min_regen_seconds,1),
    round(
      coalesce(g.regen_seconds,30) *
      (1-coalesce(gp.regen_reduction,0))
    )::int
  );

  insert into public.machine_runtime_v612(
    game_id,user_id,last_run_at
  )
  values(
    p_game_id,
    auth.uid(),
    coalesce(gp.machine_last_run_at,now()-interval_s*interval '1 second')
  )
  on conflict(game_id,user_id) do nothing;

  select last_run_at
  into last_machine_at
  from public.machine_runtime_v612
  where game_id=p_game_id
    and user_id=auth.uid();

  elapsed:=extract(
    epoch from (
      now()-coalesce(last_machine_at,now()-interval_s*interval '1 second')
    )
  );

  if elapsed<interval_s then
    return jsonb_build_object(
      'opened',0,
      'active',true,
      'machine_power',machine_power,
      'virtual_fields',machine_power,
      'seconds_to_next',
        greatest(0,ceil(interval_s-elapsed)::int)
    );
  end if;

  -- Atomare Reservierung: pro Spieler kann nur ein fälliger Maschinenwurf laufen.
  update public.machine_runtime_v612
  set last_run_at=now()
  where game_id=p_game_id
    and user_id=auth.uid()
    and last_run_at<=now()-(interval_s*interval '1 second');

  get diagnostics reserved_count = row_count;

  if reserved_count=0 then
    return jsonb_build_object(
      'opened',0,
      'active',true,
      'busy',true,
      'machine_power',machine_power,
      'seconds_to_next',interval_s
    );
  end if;

  update public.game_players
  set machine_last_run_at=now(),
      machine_ticks_used=coalesce(machine_ticks_used,0)+1
  where game_id=p_game_id
    and user_id=auth.uid();

  total_fields:=
    greatest(
      1,
      coalesce(g.width,1)::bigint *
      coalesce(g.height,1)::bigint
    );

  select count(*)::bigint
  into explored_fields_count
  from public.explored_fields
  where game_id=p_game_id;

  unknown_fields:=
    greatest(
      0,
      total_fields-explored_fields_count
    );

  -- Nur Schatzteile ohne laufende Schatzsicherung zählen als verfügbare Treffer.
  select count(*)::int
  into open_treasures
  from public.gold_treasures gt
  where gt.game_id=p_game_id
    and gt.found_by is null
    and gt.forfeited_at is null
    and not exists(
      select 1
      from public.treasure_claims_v619 tc
      where tc.treasure_id=gt.id
        and tc.status='pending'
    );

  if open_treasures<=0 then
    return jsonb_build_object(
      'opened',0,
      'active',true,
      'machine_power',machine_power,
      'virtual_fields',machine_power,
      'hit',false,
      'hit_chance',0,
      'seconds_to_next',interval_s,
      'message','⚙️ Maschinen aktiv – aktuell ist kein freies Schatzteil für die automatische Suche verfügbar.'
    );
  end if;

  -- Falls die Karte vollständig erforscht ist, greift weiterhin die
  -- Endspiel-/Claim-Reparatur aus V6.26. Die Maschine stiehlt dann keinen Schatz.
  if unknown_fields<=0 then
    return jsonb_build_object(
      'opened',0,
      'active',true,
      'machine_power',machine_power,
      'virtual_fields',machine_power,
      'hit',false,
      'hit_chance',0,
      'seconds_to_next',interval_s,
      'message','⚙️ Karte vollständig analysiert – offene Schatzsicherungen werden über den Endspiel-Schutz aufgelöst.'
    );
  end if;

  -- Schlanke Näherung an "M verschiedene unbekannte Felder prüfen".
  -- Bei mehreren offenen Schatzteilen steigt die Chance entsprechend.
  hit_chance:=least(
    1::numeric,
    greatest(
      0::numeric,
      (machine_power::numeric * open_treasures::numeric) /
      unknown_fields::numeric
    )
  );

  roll:=random();
  hit:=roll<hit_chance;

  if hit then
    select gt.id
    into target_treasure
    from public.gold_treasures gt
    where gt.game_id=p_game_id
      and gt.found_by is null
      and gt.forfeited_at is null
      and not exists(
        select 1
        from public.treasure_claims_v619 tc
        where tc.treasure_id=gt.id
          and tc.status='pending'
      )
    order by random()
    limit 1;

    if target_treasure is not null then
      claim_id:=public.create_retry_claim_v6245(
        p_game_id,
        target_treasure,
        auth.uid()
      );

      return jsonb_build_object(
        'opened',0,
        'active',true,
        'machine_power',machine_power,
        'virtual_fields',machine_power,
        'unknown_fields',unknown_fields,
        'open_treasures',open_treasures,
        'hit',true,
        'hit_chance',hit_chance,
        'claim_created',true,
        'claim_id',claim_id,
        'seconds_to_next',interval_s,
        'message',
          '🎯 Maschinenfund! Die automatische Suche hat einen Schatz geortet – Schatzsicherung starten.'
      );
    end if;
  end if;

  return jsonb_build_object(
    'opened',0,
    'active',true,
    'machine_power',machine_power,
    'virtual_fields',machine_power,
    'unknown_fields',unknown_fields,
    'open_treasures',open_treasures,
    'hit',false,
    'hit_chance',hit_chance,
    'seconds_to_next',interval_s,
    'message',
      '⚙️ Maschinen haben '||
      machine_power::text||
      ' virtuelle Felder analysiert – kein Schatzsignal.'
  );
end;
$$;

revoke all
on function public.run_machines_v613(uuid)
from public;

grant execute
on function public.run_machines_v613(uuid)
to authenticated;


-- Wrapper bleibt die einzige RPC, die der Client aufruft.
-- Advisory Lock bleibt als zusätzliche Absicherung zwischen Spielern erhalten.
create or replace function public.run_machines_game_v620(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  g public.games%rowtype;
  locked boolean;
  r jsonb;
begin
  select * into g
  from public.games
  where id=p_game_id;

  if not found or g.status<>'active' then
    return jsonb_build_object(
      'opened',0,
      'active',false
    );
  end if;

  if g.start_at is not null and g.start_at>now() then
    return jsonb_build_object(
      'opened',0,
      'active',true,
      'waiting_for_start',true,
      'seconds_to_start',
        greatest(1,ceil(extract(epoch from(g.start_at-now())))::int)
    );
  end if;

  locked:=pg_try_advisory_xact_lock(
    hashtextextended(
      'machine:'||p_game_id::text,
      0
    )
  );

  if not locked then
    return jsonb_build_object(
      'opened',0,
      'active',true,
      'busy',true,
      'reason','anderer Maschinenlauf aktiv'
    );
  end if;

  r:=public.run_machines_v613(p_game_id);
  return r;
end;
$$;

revoke all
on function public.run_machines_game_v620(uuid)
from public;

grant execute
on function public.run_machines_game_v620(uuid)
to authenticated;


-- Beschreibungen an die neue Mechanik anpassen.
update public.technologies
set description=case id
  when 'm1' then 'Automatische Suchsysteme analysieren pro Takt virtuelle Kartenfelder und können Schatzsignale orten.'
  when 'm2' then 'Mehr Suchleistung erhöht pro Takt die Wahrscheinlichkeit, einen Schatz zu orten.'
  when 'm3' then 'Ein koordinierter Schwarm erhöht die virtuelle Suchleistung stark.'
  when 'm4' then 'Der autonome Roverpark analysiert große virtuelle Flächen pro Takt.'
  when 'm5' then 'Maximale automatische Suchleistung ohne zusätzliche Karten- oder Terrainberechnung.'
  else description
end
where id in ('m1','m2','m3','m4','m5');
