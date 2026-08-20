import { NextResponse } from 'next/server'
import { configuredAppPassword,configuredAppUsername,createAppSession } from '@/lib/app-auth'

export async function POST(req:Request){
  const form=await req.formData()
  const username=String(form.get('username')||'').trim()
  const password=String(form.get('password')||'')
  const expectedUser=configuredAppUsername()
  const expectedPassword=configuredAppPassword()
  const back=new URL('/login',req.url)

  if(!expectedUser||!expectedPassword||!process.env.MTD_SESSION_SECRET){
    back.searchParams.set('error','Application login has not been configured yet.')
    return NextResponse.redirect(back,303)
  }
  if(username!==expectedUser||password!==expectedPassword){
    back.searchParams.set('error','Username or password is incorrect.')
    return NextResponse.redirect(back,303)
  }

  const token=await createAppSession(username)
  const res=NextResponse.redirect(new URL('/',req.url),303)
  res.cookies.set('mtdlab_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:60*60*12})
  return res
}
