import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { readAppSession } from './lib/app-auth'

const securityHeaders=[
  ['Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests"],
  ['Strict-Transport-Security','max-age=31536000; includeSubDomains; preload'],
  ['X-Frame-Options','DENY'],
  ['X-Content-Type-Options','nosniff'],
  ['Referrer-Policy','strict-origin-when-cross-origin'],
  ['Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(), usb=()'],
  ['Cross-Origin-Opener-Policy','same-origin'],
  ['Cross-Origin-Resource-Policy','same-origin'],
  ['X-Permitted-Cross-Domain-Policies','none'],
] as const

const publicAssets=new Set([
  '/mtd-lab-logo-exact.webp',
  '/mtd-lab-login-wordmark.svg',
  '/mtd-lab-logo-post-login.svg',
  '/mtd-lab-logo.svg',
])

const publicPages=new Set(['/login','/register','/help','/forgot-password'])

function secure(res:NextResponse){
  for(const [key,value] of securityHeaders)res.headers.set(key,value)
  return res
}

function hasInvalidTaxpayerContext(path:string){
  return /^\/taxpayers\/(undefined|null|NaN)(?:\/|$)/i.test(path)
}

async function isCurrentActiveSession(username:string,sessionId:string){
  const base=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL||'https://zpvfjabjqonnezqsztzp.supabase.co'
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||''
  if(!base||!key)return false
  try{
    const params=new URLSearchParams({select:'session_id,expires_at',username:`eq.${username.toLowerCase()}`,limit:'1'})
    const res=await fetch(`${base}/rest/v1/app_active_sessions?${params.toString()}`,{
      headers:{apikey:key,Authorization:`Bearer ${key}`},
      cache:'no-store'
    })
    if(!res.ok)return false
    const rows=await res.json() as Array<{session_id?:string;expires_at?:string}>
    const row=rows[0]
    return !!row&&row.session_id===sessionId&&!!row.expires_at&&new Date(row.expires_at).getTime()>Date.now()
  }catch{return false}
}

export async function middleware(req:NextRequest){
  const path=req.nextUrl.pathname
  if(publicPages.has(path)||publicAssets.has(path)||path==='/api/help-chat'||path.startsWith('/api/auth/')||path.startsWith('/_next/')) return secure(NextResponse.next())
  const session=await readAppSession(req.cookies.get('mtdlab_session')?.value)
  const valid=!!session&&await isCurrentActiveSession(session.username,session.sessionId)
  if(valid){
    if(hasInvalidTaxpayerContext(path)){
      const taxpayers=req.nextUrl.clone()
      taxpayers.pathname='/taxpayers'
      taxpayers.search=''
      return secure(NextResponse.redirect(taxpayers))
    }
    return secure(NextResponse.next())
  }
  const login=req.nextUrl.clone()
  login.pathname='/login'
  login.search=''
  const requested=`${req.nextUrl.pathname}${req.nextUrl.search}`
  if(requested.startsWith('/')&&!requested.startsWith('//')) login.searchParams.set('next',requested)
  if(session)login.searchParams.set('error','You were signed out because this account was signed in on another device or browser.')
  const res=NextResponse.redirect(login)
  res.cookies.set('mtdlab_session','',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0})
  return secure(res)
}

export const config={matcher:['/((?!favicon.ico|robots.txt|sitemap.xml).*)']}
