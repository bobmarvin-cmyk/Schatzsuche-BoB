import {NextResponse} from 'next/server'

const cache=new Map()

export async function GET(req){
  try{
    const q=new URL(req.url).searchParams.get('q')?.trim()
    if(!q||q.length<2)return NextResponse.json({error:'Suchbegriff zu kurz'},{status:400})

    const key=q.toLowerCase()
    if(cache.has(key))return NextResponse.json({results:cache.get(key)})

    const base=(process.env.GEOCODER_BASE_URL||'https://nominatim.openstreetmap.org').replace(/\/$/,'')
    const url=base+'/search?format=jsonv2&limit=6&addressdetails=1&q='+encodeURIComponent(q)
    const res=await fetch(url,{
      headers:{
        'User-Agent':'BoBsSchatzsuche/6.14.1 (contact: bobmarvin@gmx.de)',
        'Accept-Language':'de,en;q=0.8'
      },
      next:{revalidate:86400}
    })
    if(!res.ok)throw new Error('Geocoding-Dienst antwortet nicht')
    const raw=await res.json()
    const results=(raw||[]).map(x=>({
      lat:Number(x.lat),lon:Number(x.lon),
      label:x.display_name,
      short_label:x.name||x.display_name?.split(',')[0]||q
    })).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon))

    cache.set(key,results)
    return NextResponse.json({results})
  }catch(e){
    return NextResponse.json({error:e.message||'Ortssuche fehlgeschlagen'},{status:500})
  }
}
