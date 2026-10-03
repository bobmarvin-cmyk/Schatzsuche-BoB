import {NextResponse} from 'next/server'

export const runtime='nodejs'
export const dynamic='force-dynamic'

const cache=new Map()

function normalizeNominatim(raw,q){
  return (raw||[]).map(x=>({
    lat:Number(x.lat),lon:Number(x.lon),
    label:x.display_name,
    short_label:x.name||x.display_name?.split(',')[0]||q
  })).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon))
}

function normalizePhoton(raw,q){
  return (raw?.features||[]).map(x=>{
    const p=x.properties||{},c=x.geometry?.coordinates||[]
    const bits=[p.name,p.city,p.state,p.country].filter(Boolean)
    return {
      lat:Number(c[1]),lon:Number(c[0]),
      label:bits.join(', ')||q,
      short_label:p.name||p.city||q
    }
  }).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon))
}

export async function GET(req){
  try{
    const q=new URL(req.url).searchParams.get('q')?.trim()
    if(!q||q.length<2)return NextResponse.json({error:'Suchbegriff zu kurz'},{status:400})

    const key=q.toLowerCase()
    if(cache.has(key))return NextResponse.json({results:cache.get(key)})

    let results=[]
    const base=(process.env.GEOCODER_BASE_URL||'https://nominatim.openstreetmap.org').replace(/\/$/,'')
    try{
      const url=base+'/search?format=jsonv2&limit=8&addressdetails=1&email='+encodeURIComponent('bobmarvin@gmx.de')+'&q='+encodeURIComponent(q)
      const res=await fetch(url,{
        headers:{
          'User-Agent':'BoBsSchatzsuche/6.15 (contact: bobmarvin@gmx.de)',
          'Accept-Language':'de,en;q=0.8',
          'Referer':'https://schatzsuchebobi.vercel.app/'
        },
        cache:'no-store'
      })
      if(res.ok)results=normalizeNominatim(await res.json(),q)
    }catch{}

    if(results.length===0){
      try{
        const res=await fetch('https://photon.komoot.io/api/?limit=8&lang=de&q='+encodeURIComponent(q),{
          headers:{'User-Agent':'BoBsSchatzsuche/6.15 (contact: bobmarvin@gmx.de)'},
          cache:'no-store'
        })
        if(res.ok)results=normalizePhoton(await res.json(),q)
      }catch{}
    }

    if(results.length===0)return NextResponse.json({error:'Kein Ort gefunden oder Geocoding-Dienst momentan nicht erreichbar.'},{status:404})
    cache.set(key,results)
    return NextResponse.json({results})
  }catch(e){
    return NextResponse.json({error:e.message||'Ortssuche fehlgeschlagen'},{status:500})
  }
}
