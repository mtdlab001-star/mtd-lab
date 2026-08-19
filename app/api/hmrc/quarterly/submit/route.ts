import { NextResponse } from 'next/server'
import { verifyReviewPayload } from '@/lib/review-token'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hmrcApiBase } from '@/lib/hmrc'
import { getValidHmrcAccessToken } from '@/lib/hmrc-connection'
import { buildFraudHeaders } from '@/lib/hmrc-fraud'
import { buildSelfEmploymentCumulativePayload, buildUkPropertyCumulativePayload, cumulativeEndpoint, ukPropertyCumulativeEndpoint, taxYearFromDate } from '@/lib/hmrc-quarterly'

export async function POST(req:Request){
  const form=await req.formData()
  const token=String(form.get('reviewToken')||'')
  const p:any=verifyReviewPayload(token)
  const taxpayerId=String(p?.taxpayerId||'demo')
  const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/quarterly/review`,req.url)
  back.searchParams.set('data',token)
  if(!p){back.searchParams.set('error','Review token is invalid or has been altered');return NextResponse.redirect(back,303)}
  if(!p.periodStart||p.periodStart<'2025-04-06'){back.searchParams.set('error','Cumulative quarterly submission requires tax year 2025/26 or later');return NextResponse.redirect(back,303)}
  if(process.env.HMRC_ENVIRONMENT==='production'&&process.env.HMRC_ALLOW_PRODUCTION_SUBMISSIONS!=='true'){
    back.searchParams.set('error','Production HMRC submissions are locked. Complete sandbox testing and explicitly enable production submissions first.')
    return NextResponse.redirect(back,303)
  }

  const db=supabaseAdmin()
  const {data:taxpayer,error:taxpayerError}=await db.from('taxpayers').select('nino').eq('id',taxpayerId).maybeSingle()
  if(taxpayerError||!taxpayer?.nino){back.searchParams.set('error','HMRC taxpayer record is missing a NINO');return NextResponse.redirect(back,303)}

  let accessToken:string
  try{accessToken=await getValidHmrcAccessToken(taxpayerId)}catch(e:any){back.searchParams.set('error',e.message||'HMRC connection is incomplete');return NextResponse.redirect(back,303)}

  const fraud=buildFraudHeaders(req,form,taxpayerId)
  if(fraud.missing.length){back.searchParams.set('readiness','blocked');back.searchParams.set('missing',fraud.missing.join(','));return NextResponse.redirect(back,303)}

  const taxYear=taxYearFromDate(p.periodStart)
  const property=p.filingType==='property'
  const requestPayload=property?buildUkPropertyCumulativePayload(p):buildSelfEmploymentCumulativePayload(p)
  const endpoint=property?ukPropertyCumulativeEndpoint(taxpayer.nino,p.businessId,taxYear):cumulativeEndpoint(taxpayer.nino,p.businessId,taxYear)
  const acceptVersion=property?'6.0':'5.0'

  const {data:audit,error:auditError}=await db.from('hmrc_quarterly_submissions').insert({
    taxpayer_id:taxpayerId,
    business_id:p.businessId,
    period_start:p.periodStart,
    period_end:p.periodEnd,
    tax_year:taxYear,
    status:'sending',
    request_payload:{filingType:p.filingType||'self-employment',payload:requestPayload}
  }).select('id').maybeSingle()

  if(auditError||!audit?.id){
    back.searchParams.set('error','Submission audit storage is not ready. Apply the Supabase quarterly submissions migration before sending anything to HMRC.')
    return NextResponse.redirect(back,303)
  }

  const auditId=audit.id
  try{
    const res=await fetch(`${hmrcApiBase}${endpoint}`,{
      method:'PUT',
      headers:{
        Authorization:`Bearer ${accessToken}`,
        Accept:`application/vnd.hmrc.${acceptVersion}+json`,
        'Content-Type':'application/json',
        ...(process.env.HMRC_ENVIRONMENT==='production'?{}:{'Gov-Test-Scenario':process.env.HMRC_TEST_SCENARIO||'DEFAULT'}),
        ...fraud.headers
      },
      body:JSON.stringify(requestPayload),
      cache:'no-store'
    })
    const text=await res.text()
    let responsePayload:any={}
    try{responsePayload=text?JSON.parse(text):{}}catch{responsePayload={raw:text}}
    const correlationId=res.headers.get('x-correlationid')||res.headers.get('x-correlation-id')
    await db.from('hmrc_quarterly_submissions').update({
      status:res.ok?'submitted':'failed',response_payload:responsePayload,hmrc_correlation_id:correlationId,hmrc_http_status:res.status,
      error_message:res.ok?null:(responsePayload?.message||text||`HMRC ${res.status}`),submitted_at:res.ok?new Date().toISOString():null,updated_at:new Date().toISOString()
    }).eq('id',auditId)
    if(!res.ok)throw new Error(responsePayload?.message||responsePayload?.code||`HMRC ${res.status}`)
    back.searchParams.set('submitted','1')
    if(correlationId)back.searchParams.set('correlationId',correlationId)
    return NextResponse.redirect(back,303)
  }catch(e:any){
    await db.from('hmrc_quarterly_submissions').update({status:'failed',error_message:e.message||'HMRC submission failed',updated_at:new Date().toISOString()}).eq('id',auditId)
    back.searchParams.set('error',e.message||'HMRC submission failed')
    return NextResponse.redirect(back,303)
  }
}
