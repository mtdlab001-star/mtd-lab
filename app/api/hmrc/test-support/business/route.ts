import { NextResponse } from 'next/server'
import { hmrcApiBase } from '@/lib/hmrc'
import { getValidHmrcAccessToken } from '@/lib/hmrc-connection'
import { isSameOriginRequest } from '@/lib/request-security'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { currentWorkspace } from '@/lib/workspace'
import { buildFraudHeaders } from '@/lib/hmrc-fraud'

const allowedPropertyTypes=new Set(['uk-property','foreign-property'])

function backUrl(req:Request,taxpayerId:string){
  return new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/businesses`,req.url)
}

export async function POST(req:Request){
  if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
  const workspace=await currentWorkspace()
  if(!workspace)return new NextResponse('Accounting workspace access is not available',{status:403})
  const form=await req.formData()
  const taxpayerId=String(form.get('taxpayerId')||'').trim()
  const businessType=String(form.get('businessType')||'').trim()
  const back=backUrl(req,taxpayerId)

  if(process.env.HMRC_ENVIRONMENT==='production'){
    back.searchParams.set('testBusinessError','HMRC test businesses can only be created in the sandbox environment.')
    return NextResponse.redirect(back,303)
  }
  if(!taxpayerId||!allowedPropertyTypes.has(businessType)){
    back.searchParams.set('testBusinessError','Choose a supported HMRC sandbox property business type.')
    return NextResponse.redirect(back,303)
  }

  try{
    const db=supabaseAdmin()
    const {data:taxpayer,error}=await db.from('taxpayers').select('nino').eq('id',taxpayerId).eq('firm_id',workspace.firmId).maybeSingle()
    if(error||!taxpayer?.nino)throw new Error('The taxpayer is not available in this accounting workspace or has no NINO.')
    const accessToken=await getValidHmrcAccessToken(taxpayerId)
    const fraud=buildFraudHeaders(req,form,taxpayerId)
    if(fraud.missing.length)throw new Error(`Missing HMRC fraud prevention data: ${fraud.missing.join(', ')}`)
    const response=await fetch(`${hmrcApiBase}/individuals/self-assessment-test-support/business/${encodeURIComponent(taxpayer.nino)}`,{
      method:'POST',
      headers:{
        Authorization:`Bearer ${accessToken}`,
        Accept:'application/vnd.hmrc.1.0+json',
        'Content-Type':'application/json',
        ...fraud.headers
      },
      body:JSON.stringify({typeOfBusiness:businessType}),
      cache:'no-store'
    })
    const raw=await response.text()
    let payload:any={}
    try{payload=raw?JSON.parse(raw):{}}catch{payload={}}
    const correlationId=response.headers.get('x-correlationid')||response.headers.get('x-correlation-id')||''
    if(!response.ok)throw new Error(payload?.message||payload?.code||`HMRC ${response.status}`)
    back.searchParams.set('testBusinessCreated',businessType)
    if(payload?.businessId)back.searchParams.set('businessId',String(payload.businessId))
    if(correlationId)back.searchParams.set('correlationId',correlationId)
    return NextResponse.redirect(back,303)
  }catch(error:any){
    back.searchParams.set('testBusinessError',error.message||'Could not create the HMRC sandbox property business.')
    return NextResponse.redirect(back,303)
  }
}
