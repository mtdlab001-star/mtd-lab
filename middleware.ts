import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyAppSession } from './lib/app-auth'

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

const publicPages=new Set(['/login','/help','/forgot-password'])

function secure(res:NextResponse){
  for(const [key,value] of securityHeaders)res.headers.set(key,value)
  return res
}

function hasInvalidTaxpayerContext(path:string){
  return /^\/taxpayers\/(undefined|null|NaN)(?:\/|$)/i.test(path)
}

export async function middleware(req:NextRequest){
  const path=req.nextUrl.pathname
  if(publicPages.has(path)||publicAssets.has(path)||path==='/api/help-chat'||path.startsWith('/api/auth/')||path.startsWith('/_next/')) return secure(NextResponse.next())
  const valid=await verifyAppSession(req.cookies.get('mtdlab_session')?.value)
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
  return secure(NextResponse.redirect(login))
}

export const config={matcher:['/((?!favicon.ico|robots.txt|sitemap.xml).*)']}
