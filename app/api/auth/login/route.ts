import { NextResponse } from 'next/server'
import { configuredAppPassword,configuredAppUsername,constantTimeEqual,createAppSession } from '@/lib/app-auth'
import { assessLoginRateLimit,pruneLoginAttemptAudit,recordLoginAttempt } from '@/lib/login-rate-limit'
import { isSameOriginRequest } from '@/lib/request-security'

function safeNext(value:string){return value.startsWith('/')&&!value.startsWith('//')?value:'/'}

export async function POST(req:Request){
 if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
  const form=await req.formData()
  const username=String(form.get('username')||'').trim()
  const password=String(form.get('password')||'')
  const remember=String(form.get('remember')||'')==='on'
  const next=safeNext(String(form.get('next')||'/'))
  const expectedUser=configuredAppUsername()
  const expectedPassword=configuredAppPassword()
  const back=new URL('/login',req.url)
  if(next!=='/')back.searchParams.set('next',next)

  if(!expectedUser||!expectedPassword||!process.env.MTD_SESSION_SECRET){
    back.searchParams.set('error','Application login has not been configured yet.')
    return NextResponse.redirect(back,303)
  }
  const rateLimit=await assessLoginRateLimit(req,username)
  if(rateLimit.limited){
    await recordLoginAttempt(req,username,false,'rate_limited')
    back.searchParams.set('error','Too many sign in attempts. Wait a few minutes and try again.')
    return NextResponse.redirect(back,303)
  }
  const validUser=await constantTimeEqual(username,expectedUser)
  const validPassword=await constantTimeEqual(password,expectedPassword)
  if(!validUser||!validPassword){
    await recordLoginAttempt(req,username,false,'invalid_credentials')
    back.searchParams.set('error','Username or password is incorrect.')
    return NextResponse.redirect(back,303)
  }

  const maxAge=remember?60*60*24*30:60*60*12
  const token=await createAppSession(username,maxAge)
  await recordLoginAttempt(req,username,true,'success')
  void pruneLoginAttemptAudit()
  const res=NextResponse.redirect(new URL(next,req.url),303)
  res.cookies.set('mtdlab_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge})
  return res
}
