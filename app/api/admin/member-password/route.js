import {NextResponse} from 'next/server'
import {createClient} from '@supabase/supabase-js'

export async function POST(request){
  try{
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const service=process.env.SUPABASE_SERVICE_ROLE_KEY
    if(!url||!anon||!service){
      return NextResponse.json(
        {error:'Server-Konfiguration für Passwort-Reset fehlt.'},
        {status:500}
      )
    }

    const authHeader=request.headers.get('authorization')||''
    const token=authHeader.startsWith('Bearer ')?authHeader.slice(7):''
    if(!token)return NextResponse.json({error:'Nicht angemeldet'},{status:401})

    const userClient=createClient(url,anon,{
      global:{headers:{Authorization:`Bearer ${token}`}},
      auth:{persistSession:false,autoRefreshToken:false}
    })
    const {data:{user},error:userError}=await userClient.auth.getUser(token)
    if(userError||!user)return NextResponse.json({error:'Sitzung ungültig'},{status:401})

    const {data:isAdmin,error:adminError}=await userClient.rpc('is_admin_v67')
    if(adminError||!isAdmin)return NextResponse.json({error:'Keine Admin-Berechtigung'},{status:403})

    const body=await request.json()
    const userId=String(body?.user_id||'')
    const password=String(body?.password||'')
    if(!/^[0-9a-f-]{36}$/i.test(userId)){
      return NextResponse.json({error:'Ungültige Nutzer-ID'},{status:400})
    }
    if(password.length<8||password.length>128){
      return NextResponse.json({error:'Passwort muss 8 bis 128 Zeichen haben'},{status:400})
    }

    const admin=createClient(url,service,{
      auth:{persistSession:false,autoRefreshToken:false}
    })
    const {error}=await admin.auth.admin.updateUserById(userId,{password})
    if(error)return NextResponse.json({error:error.message},{status:400})

    return NextResponse.json({ok:true,message:'Neues Passwort wurde gesetzt.'})
  }catch(err){
    return NextResponse.json({error:err?.message||'Unbekannter Serverfehler'},{status:500})
  }
}
