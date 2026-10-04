-- V6.20.2 HOTFIX
-- Nach V6.20 EINMAL ausführen.
-- Neue Bergungsprüfungen: keine Rechenaufgaben mehr.

create or replace function public.intercept_treasure_claim_v619()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  display_code text:='';
  answer_code text:='';
  ctype text;
  payload jsonb:='{}'::jsonb;
  i int;
begin
  if old.found_by is null
     and new.found_by is not null
     and coalesce(current_setting('app.claim_finalize',true),'')<>'1' then

    case floor(random()*3)::int
      when 0 then ctype:='memory_forward';
      when 1 then ctype:='memory_reverse';
      else ctype:='memory_swap';
    end case;

    for i in 1..6 loop
      display_code:=display_code||(1+floor(random()*4)::int)::text;
    end loop;

    if ctype='memory_reverse' then
      answer_code:=reverse(display_code);
    elsif ctype='memory_swap' then
      answer_code:=substr(display_code,2,1)||substr(display_code,1,1)||
                   substr(display_code,4,1)||substr(display_code,3,1)||
                   substr(display_code,6,1)||substr(display_code,5,1);
    else
      answer_code:=display_code;
    end if;

    payload:=jsonb_build_object('display_code',display_code);

    insert into public.treasure_claims_v619(
      game_id,treasure_id,user_id,challenge_code,challenge_type,challenge_payload,
      status,expires_at
    )
    values(
      old.game_id,old.id,new.found_by,answer_code,ctype,payload,
      'pending',now()+interval '5 minutes'
    )
    on conflict do nothing;

    return null;
  end if;

  return new;
end;
$$;

-- Start-RPC liefert nun auch memory_swap aus.
create or replace function public.start_treasure_claim_v620(p_claim_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare c public.treasure_claims_v619%rowtype;
begin
 select * into c from public.treasure_claims_v619
 where id=p_claim_id and user_id=auth.uid()
 for update;
 if not found or c.status<>'pending' then raise exception 'Bergungsprüfung nicht mehr aktiv'; end if;
 if c.started_at is not null then raise exception 'Bergungsprüfung wurde bereits gestartet'; end if;

 update public.treasure_claims_v619
 set started_at=now(),expires_at=now()+interval '90 seconds'
 where id=c.id
 returning * into c;

 return jsonb_build_object(
   'id',c.id,
   'challenge_type',c.challenge_type,
   'display_code',case
     when c.challenge_type in ('memory_forward','memory_reverse','memory_swap')
     then c.challenge_payload->>'display_code'
     else null end,
   'expires_at',c.expires_at
 );
end;
$$;
revoke all on function public.start_treasure_claim_v620(uuid) from public;
grant execute on function public.start_treasure_claim_v620(uuid) to authenticated;
