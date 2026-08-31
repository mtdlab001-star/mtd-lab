import { NextResponse } from 'next/server'
import { resetPasswordWithToken } from '@/lib/password-reset'
import { isSameOriginRequest } from '@/lib/request-security'

export async function POST(req:Request){
  if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
  const form=await req.formData()
  const token=String(form.get('token')||'')
  const password=String(form.get('password')||'')
  const confirmPassword=String(form.get('confirmPassword')||'')
  const back=new URL('/reset-password',req.url)
  if(token)back.searchParams.set('token',token)

  try{
    const result=await resetPasswordWithToken(req,token,password,confirmPassword)
    if(!result.ok){
      back.searchParams.set('error',result.message)
      return NextResponse.redirect(back,303)
    }
    const success=new URL('/reset-password',req.url)
    success.searchParams.set('success','1')
    const res=NextResponse.redirect(success,303)
    res.cookies.set('mtdlab_session','',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0})
    return res
  }catch(error){
    console.error('Password reset completion failed',error)
    back.searchParams.set('error','Password reset is temporarily unavailable. Try again later.')
    return NextResponse.redirect(back,303)
  }
}
