import { configuredAppEmail,configuredAppUsername,constantTimeEqual,setStoredAppPassword } from '@/lib/app-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

const RESET_TOKEN_MINUTES=30
const RESET_WINDOW_SECONDS=15*60
const RESET_REQUEST_LIMIT=5
const encoder=new TextEncoder()

type ResetIdentity={ipHash:string;accountHash:string}

function resetSecret(){return process.env.PASSWORD_RESET_SECRET||process.env.LOGIN_RATE_LIMIT_SECRET||process.env.MTD_SESSION_SECRET||''}

function clientIp(req:Request){
  const forwarded=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded||req.headers.get('x-real-ip')||req.headers.get('cf-connecting-ip')||'unknown'
}

function bytesToBase64Url(bytes:Uint8Array){
  let binary=''
  for(const byte of bytes)binary+=String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
}

function createResetToken(){
  const bytes=crypto.getRandomValues(new Uint8Array(32))
  return bytesToBase64Url(bytes)
}

async function hmacHex(value:string){
  const secret=resetSecret()
  if(!secret)throw new Error('Password reset secret is not configured')
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign'])
  const sig=await crypto.subtle.sign('HMAC',key,encoder.encode(value))
  return Array.from(new Uint8Array(sig)).map(b=>b.toString(16).padStart(2,'0')).join('')
}

function normaliseAccount(account:string){return account.trim().toLowerCase()}

async function resetIdentity(req:Request,account:string):Promise<ResetIdentity>{
  const [ipHash,accountHash]=await Promise.all([
    hmacHex(`reset-ip:${clientIp(req)}`),
    hmacHex(`reset-account:${normaliseAccount(account)||'unknown'}`),
  ])
  return {ipHash,accountHash}
}

async function knownAccount(account:string){
  const normalised=normaliseAccount(account)
  const username=configuredAppUsername().trim().toLowerCase()
  const email=configuredAppEmail().trim().toLowerCase()
  if(!normalised)return false
  if(username&&await constantTimeEqual(normalised,username))return true
  if(email&&await constantTimeEqual(normalised,email))return true
  return false
}

async function countRecentResetRequests(ipHash:string,accountHash:string){
  const since=new Date(Date.now()-RESET_WINDOW_SECONDS*1000).toISOString()
  const db=supabaseAdmin()
  const [ipCount,accountCount]=await Promise.all([
    db.from('app_password_reset_audit').select('id',{count:'exact',head:true}).eq('ip_hash',ipHash).gte('created_at',since),
    db.from('app_password_reset_audit').select('id',{count:'exact',head:true}).eq('account_hash',accountHash).gte('created_at',since),
  ])
  if(ipCount.error)throw ipCount.error
  if(accountCount.error)throw accountCount.error
  return Math.max(ipCount.count||0,accountCount.count||0)
}

async function recordResetAudit(req:Request,identity:ResetIdentity,event:string,deliveryStatus:string){
  const userAgent=(req.headers.get('user-agent')||'').slice(0,240)
  const {error}=await supabaseAdmin().from('app_password_reset_audit').insert({
    ip_hash:identity.ipHash,
    account_hash:identity.accountHash,
    event,
    delivery_status:deliveryStatus,
    user_agent:userAgent||null,
  })
  if(error)throw error
}

async function sendResetEmail(account:string,resetUrl:string){
  const apiKey=process.env.RESEND_API_KEY
  const from=process.env.PASSWORD_RESET_FROM
  const to=configuredAppEmail()||process.env.PASSWORD_RESET_TO||(account.includes('@')?account:'')
  if(!apiKey||!from||!to)return 'email_not_configured'

  try{
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        from,
        to,
        subject:'Reset your MTD Lab password',
        text:`A password reset was requested for MTD Lab. Use this secure link within ${RESET_TOKEN_MINUTES} minutes: ${resetUrl}\n\nIf you did not request this, ignore this message. MTD Lab will never ask you to reveal your password or HMRC credentials.`,
      }),
    })
    return response.ok?'email_sent':'email_failed'
  }catch(error){
    console.error('Password reset email failed',error)
    return 'email_failed'
  }
}

export function passwordMeetsPolicy(password:string){
  return password.length>=12&&/[a-z]/.test(password)&&/[A-Z]/.test(password)&&/[0-9]/.test(password)
}

export async function createPasswordResetRequest(req:Request,account:string){
  if(!resetSecret())throw new Error('Password reset secret is not configured')
  const identity=await resetIdentity(req,account)
  const recentRequests=await countRecentResetRequests(identity.ipHash,identity.accountHash)
  if(recentRequests>=RESET_REQUEST_LIMIT){
    await recordResetAudit(req,identity,'rate_limited','not_sent')
    return {accepted:true,deliveryStatus:'rate_limited'}
  }

  const accountExists=await knownAccount(account)
  if(!accountExists){
    await recordResetAudit(req,identity,'requested_unknown_account','not_sent')
    return {accepted:true,deliveryStatus:'not_sent'}
  }

  const token=createResetToken()
  const tokenHash=await hmacHex(`reset-token:${token}`)
  const expiresAt=new Date(Date.now()+RESET_TOKEN_MINUTES*60*1000).toISOString()
  const userAgent=(req.headers.get('user-agent')||'').slice(0,240)
  const resetUrl=new URL('/reset-password',req.url)
  resetUrl.searchParams.set('token',token)

  const {error}=await supabaseAdmin().from('app_password_reset_tokens').insert({
    account_hash:identity.accountHash,
    token_hash:tokenHash,
    expires_at:expiresAt,
    ip_hash:identity.ipHash,
    user_agent:userAgent||null,
    delivery_status:'created',
  })
  if(error)throw error

  const deliveryStatus=await sendResetEmail(account,resetUrl.toString())
  await supabaseAdmin().from('app_password_reset_tokens').update({delivery_status:deliveryStatus}).eq('token_hash',tokenHash)
  await recordResetAudit(req,identity,'requested',deliveryStatus)
  return {accepted:true,deliveryStatus}
}

export async function resetPasswordWithToken(req:Request,token:string,password:string,confirmPassword:string){
  if(password!==confirmPassword)return {ok:false,message:'The two passwords do not match.'}
  if(!passwordMeetsPolicy(password))return {ok:false,message:'Use at least 12 characters with uppercase, lowercase and a number.'}
  if(!token||token.length>512)return {ok:false,message:'This reset link is invalid or expired.'}

  const identity=await resetIdentity(req,'token-reset')
  const tokenHash=await hmacHex(`reset-token:${token}`)
  const db=supabaseAdmin()
  const {data,error}=await db
    .from('app_password_reset_tokens')
    .select('id,account_hash,expires_at,used_at')
    .eq('token_hash',tokenHash)
    .maybeSingle()
  if(error)throw error
  if(!data||data.used_at||new Date(String(data.expires_at)).getTime()<Date.now()){
    await recordResetAudit(req,identity,'invalid_or_expired','not_sent')
    return {ok:false,message:'This reset link is invalid or expired.'}
  }

  const username=configuredAppUsername()
  if(!username)return {ok:false,message:'Application login has not been configured yet.'}
  await setStoredAppPassword(username,password)
  const now=new Date().toISOString()
  const update=await db.from('app_password_reset_tokens').update({used_at:now}).eq('id',data.id).is('used_at',null)
  if(update.error)throw update.error
  await db.from('app_password_reset_tokens').update({used_at:now}).eq('account_hash',String(data.account_hash)).is('used_at',null)
  await recordResetAudit(req,{...identity,accountHash:String(data.account_hash)},'completed','not_sent')
  return {ok:true,message:'Password reset complete.'}
}
