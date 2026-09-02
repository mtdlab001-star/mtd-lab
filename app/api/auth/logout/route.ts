import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { isSameOriginRequest } from '@/lib/request-security'
import { readAppSession } from '@/lib/app-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req:Request){
 if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
  try{
    const jar=await cookies()
    const session=await readAppSession(jar.get('mtdlab_session')?.value)
    if(session){
      const db=supabaseAdmin()
      await db.from('app_active_sessions').delete().eq('username',session.username.toLowerCase()).eq('session_id',session.sessionId)
    }
  }catch{}
  const res=NextResponse.redirect(new URL('/login',req.url),303)
  res.cookies.set('mtdlab_session','',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0})
  return res
}
