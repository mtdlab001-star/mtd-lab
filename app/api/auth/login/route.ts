import { NextResponse } from 'next/server'
import { configuredAppPassword,configuredAppUsername,constantTimeEqual,createAppSession } from '@/lib/app-auth'
import { assessLoginRateLimit,pruneLoginAttemptAudit,recordLoginAttempt } from '@/lib/login-rate-limit'
import { verifyPassword } from '@/lib/password-hash'
import { isSameOriginRequest } from '@/lib/request-security'
import { supabaseAdmin } from '@/lib/supabase-admin'

function safeNext(value:string){return value.startsWith('/')&&!value.startsWith('//')?value:'/'}

export async function POST(req:Request){
 if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
  const form=await req.formData()
  const username=String(form.get('username')||'').trim()
  const normalizedUsername=username.toLowerCase()
  const password=String(form.get('password')||'')
  const remember=String(form.get('remember')||'')==='on'
  const next=safeNext(String(form.get('next')||'/'))
  const expectedUser=configuredAppUsername()
  const expectedPassword=configuredAppPassword()
  const back=new URL('/login',req.url)
  if(next!=='/')back.searchParams.set('next',next)

  if(!process.env.MTD_SESSION_SECRET){
    back.searchParams.set('error','Application login has not been configured yet.')
    return NextResponse.redirect(back,303)
  }

  const rateLimit=await assessLoginRateLimit(req,normalizedUsername)
  let valid=false
  let blockedReason=''
  let sessionUsername=username

  if(expectedUser&&expectedPassword&&await constantTimeEqual(username,expectedUser)){
    valid=await constantTimeEqual(password,expectedPassword)
    sessionUsername=expectedUser
  }else{
    try{
      const db=supabaseAdmin()
      const {data:user,error:userError}=await db.from('app_users').select('id,username,password_hash,status,firm_id').ilike('username',normalizedUsername).maybeSingle()
      if(userError)throw userError
      let firmStatus:string|undefined
      if(user?.firm_id){
        const {data:firm,error:firmError}=await db.from('accounting_firms').select('status').eq('id',user.firm_id).maybeSingle()
        if(firmError)throw firmError
        firmStatus=firm?.status
      }
      if(user&&user.status==='approved'&&firmStatus==='approved'){
        valid=await verifyPassword(password,user.password_hash)
        sessionUsername=user.username
        if(valid)await db.from('app_users').update({last_login_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',user.id)
      }else if(user&&(user.status==='pending'||firmStatus==='pending')) blockedReason='Your accounting firm registration is awaiting approval.'
      else if(user&&(user.status==='suspended'||firmStatus==='suspended')) blockedReason='This accounting firm account is suspended.'
      else if(user&&(user.status==='rejected'||firmStatus==='rejected')) blockedReason='This accounting firm registration has not been approved.'
    }catch(error){
      console.error('Firm user login lookup failed',error)
    }
  }

  if(rateLimit.limited&&!valid){
    await recordLoginAttempt(req,normalizedUsername,false,'rate_limited')
    back.searchParams.set('error','Too many sign in attempts. Wait a few minutes and try again.')
    return NextResponse.redirect(back,303)
  }
  if(!valid){
    await recordLoginAttempt(req,normalizedUsername,false,blockedReason?'account_not_approved':'invalid_credentials')
    back.searchParams.set('error',blockedReason||'Username or password is incorrect.')
    return NextResponse.redirect(back,303)
  }

  const maxAge=remember?60*60*24*30:60*60*12
  const session=await createAppSession(sessionUsername,maxAge)
  try{
    const db=supabaseAdmin()
    const {error:sessionError}=await db.from('app_active_sessions').upsert({
      username:sessionUsername.toLowerCase(),
      session_id:session.sessionId,
      issued_at:new Date().toISOString(),
      expires_at:new Date(session.expires).toISOString(),
      updated_at:new Date().toISOString()
    },{onConflict:'username'})
    if(sessionError)throw sessionError
  }catch(error){
    console.error('Could not establish single-user session',error)
    back.searchParams.set('error','Sign in could not be completed. Please try again.')
    return NextResponse.redirect(back,303)
  }

  await recordLoginAttempt(req,normalizedUsername,true,'success')
  void pruneLoginAttemptAudit()
  const res=NextResponse.redirect(new URL(next,req.url),303)
  res.cookies.set('mtdlab_session',session.token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge})
  return res
}
