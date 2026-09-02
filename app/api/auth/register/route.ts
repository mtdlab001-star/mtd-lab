import {NextResponse} from 'next/server'
import {supabaseAdmin} from '@/lib/supabase-admin'
import {hashPassword} from '@/lib/password-hash'
import {isSameOriginRequest} from '@/lib/request-security'

function clean(value:FormDataEntryValue|null,max=160){return String(value||'').trim().slice(0,max)}

export async function POST(req:Request){
  if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
  const form=await req.formData()
  const fullName=clean(form.get('fullName'))
  const firmName=clean(form.get('firmName'))
  const email=clean(form.get('email')).toLowerCase()
  const username=clean(form.get('username'),60).toLowerCase()
  const phone=clean(form.get('phone'),40)
  const postcode=clean(form.get('postcode'),20).toUpperCase()
  const companyNumber=clean(form.get('companyNumber'),30).toUpperCase()
  const arn=clean(form.get('arn'),30).toUpperCase()
  const password=String(form.get('password')||'')
  const confirmPassword=String(form.get('confirmPassword')||'')
  const accepted=String(form.get('terms')||'')==='on'
  const back=new URL('/register',req.url)

  if(!fullName||!firmName||!email||!username||!password||!accepted){
    back.searchParams.set('error','Complete all required fields and accept the terms.')
    return NextResponse.redirect(back,303)
  }
  if(!/^\S+@\S+\.\S+$/.test(email)){
    back.searchParams.set('error','Enter a valid email address.')
    return NextResponse.redirect(back,303)
  }
  if(!/^[a-z0-9._-]{4,60}$/.test(username)){
    back.searchParams.set('error','Username must be 4-60 characters using letters, numbers, dot, underscore or hyphen.')
    return NextResponse.redirect(back,303)
  }
  if(password.length<12){
    back.searchParams.set('error','Password must be at least 12 characters.')
    return NextResponse.redirect(back,303)
  }
  if(password!==confirmPassword){
    back.searchParams.set('error','Passwords do not match.')
    return NextResponse.redirect(back,303)
  }

  const db=supabaseAdmin()
  const {data:existing,error:existingError}=await db.from('app_users').select('id').or(`email.eq.${email},username.eq.${username}`).limit(1)
  if(existingError){
    back.searchParams.set('error','Registration is temporarily unavailable. Please try again.')
    return NextResponse.redirect(back,303)
  }
  if(existing?.length){
    back.searchParams.set('error','That email address or username is already registered.')
    return NextResponse.redirect(back,303)
  }

  const passwordHash=await hashPassword(password)
  const {data:firm,error:firmError}=await db.from('accounting_firms').insert({firm_name:firmName,company_number:companyNumber||null,arn:arn||null,phone:phone||null,postcode:postcode||null,status:'pending'}).select('id').single()
  if(firmError||!firm){
    back.searchParams.set('error','Registration could not be created. Please try again.')
    return NextResponse.redirect(back,303)
  }

  const {data:user,error:userError}=await db.from('app_users').insert({firm_id:firm.id,full_name:fullName,email,username,phone:phone||null,password_hash:passwordHash,role:'firm_admin',status:'pending'}).select('id').single()
  if(userError||!user){
    await db.from('accounting_firms').delete().eq('id',firm.id)
    back.searchParams.set('error','Registration could not be completed. Please try again.')
    return NextResponse.redirect(back,303)
  }

  await db.from('firm_access_audit').insert({firm_id:firm.id,user_id:user.id,action:'registration_submitted',actor:'self-registration',detail:{email,username}})
  const done=new URL('/register',req.url)
  done.searchParams.set('success','1')
  return NextResponse.redirect(done,303)
}
