import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyAppSession } from './lib/app-auth'

export async function middleware(req:NextRequest){
  const path=req.nextUrl.pathname
  const publicAsset=/\.(?:png|jpe?g|webp|svg|ico)$/i.test(path)
  if(path==='/login'||publicAsset||path.startsWith('/api/auth/')||path.startsWith('/_next/')) return NextResponse.next()
  const valid=await verifyAppSession(req.cookies.get('mtdlab_session')?.value)
  if(valid) return NextResponse.next()
  const login=req.nextUrl.clone()
  login.pathname='/login'
  login.search=''
  const requested=`${req.nextUrl.pathname}${req.nextUrl.search}`
  if(requested.startsWith('/')&&!requested.startsWith('//')) login.searchParams.set('next',requested)
  return NextResponse.redirect(login)
}

export const config={matcher:['/((?!favicon.ico|robots.txt|sitemap.xml).*)']}
