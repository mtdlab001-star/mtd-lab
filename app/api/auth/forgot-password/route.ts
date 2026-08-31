import { NextResponse } from 'next/server'
import { isSameOriginRequest } from '@/lib/request-security'

export async function POST(req:Request){
  if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
  const form=await req.formData()
  const account=String(form.get('account')||'').trim()
  if(account)console.info('Password reset requested for an MTD Lab account')
  const back=new URL('/forgot-password',req.url)
  back.searchParams.set('sent','1')
  return NextResponse.redirect(back,303)
}
