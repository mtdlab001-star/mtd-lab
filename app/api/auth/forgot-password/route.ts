import { NextResponse } from 'next/server'
import { createPasswordResetRequest } from '@/lib/password-reset'
import { isSameOriginRequest } from '@/lib/request-security'

export async function POST(req:Request){
  if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
  const form=await req.formData()
  const account=String(form.get('account')||'').trim()
  const back=new URL('/forgot-password',req.url)
  back.searchParams.set('sent','1')
  try{
    await createPasswordResetRequest(req,account)
  }catch(error){
    console.error('Password reset request failed',error)
  }
  return NextResponse.redirect(back,303)
}
