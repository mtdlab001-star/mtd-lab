import { NextResponse } from 'next/server'
import { isSameOriginRequest } from '@/lib/request-security'

export async function POST(req:Request){
 if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
  const res=NextResponse.redirect(new URL('/login',req.url),303)
  res.cookies.set('mtdlab_session','',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0})
  return res
}
