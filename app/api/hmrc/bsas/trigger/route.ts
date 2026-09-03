import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hmrcApiBase } from '@/lib/hmrc'
import { getValidHmrcAccessToken } from '@/lib/hmrc-connection'
import { buildFraudHeaders } from '@/lib/hmrc-fraud'
import { isSameOriginRequest } from '@/lib/request-security'
import { currentWorkspace } from '@/lib/workspace'

function yearDates(taxYear:string){const start=Number(taxYear.slice(0,4));return {startDate:`${start}-04-06`,endDate:`${start+1}-04-05`}}

export async function POST(req:Request){
 if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
 const workspace=await currentWorkspace();if(!workspace)return new NextResponse('Accounting workspace access is not available',{status:403})
 const form=await req.formData()
 const taxpayerId=String(form.get('taxpayerId')||'demo')
 const taxYear=String(form.get('taxYear')||'')
 const businessId=String(form.get('businessId')||'')
 const typeOfBusiness=String(form.get('typeOfBusiness')||'self-employment')
 const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/end-of-year/adjustments`,req.url)
 back.searchParams.set('taxYear',taxYear)
 if(!/^20\d{2}-\d{2}$/.test(taxYear)||!businessId||!['self-employment','uk-property'].includes(typeOfBusiness)){
  back.searchParams.set('error','Tax year, business and income source type are required')
  return NextResponse.redirect(back,303)
 }
 const db=supabaseAdmin();const [{data:taxpayer},{data:business}]=await Promise.all([
  db.from('taxpayers').select('nino').eq('id',taxpayerId).eq('firm_id',workspace.firmId).maybeSingle(),
  db.from('hmrc_businesses').select('id').eq('taxpayer_id',taxpayerId).eq('firm_id',workspace.firmId).eq('business_id',businessId).maybeSingle()
 ])
 if(!taxpayer?.nino||!business){back.searchParams.set('error','Taxpayer or HMRC business is not available in this accounting workspace');return NextResponse.redirect(back,303)}
 let token:string
 try{token=await getValidHmrcAccessToken(taxpayerId)}catch(e:any){back.searchParams.set('error',e.message||'HMRC connection is incomplete');return NextResponse.redirect(back,303)}
 const fraud=buildFraudHeaders(req,form,taxpayerId)
 if(fraud.missing.length){back.searchParams.set('error',`Missing HMRC fraud prevention data: ${fraud.missing.join(', ')}`);return NextResponse.redirect(back,303)}
 const accountingPeriod=yearDates(taxYear)
 const payload={accountingPeriod,typeOfBusiness,businessId}
 try{
  const res=await fetch(`${hmrcApiBase}/individuals/self-assessment/adjustable-summary/${encodeURIComponent(taxpayer.nino)}/trigger`,{
   method:'POST',
   headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.hmrc.7.0+json','Content-Type':'application/json',...(process.env.HMRC_ENVIRONMENT==='production'?{}:{'Gov-Test-Scenario':'DEFAULT'}),...fraud.headers},
   body:JSON.stringify(payload),cache:'no-store'
  })
  const text=await res.text();let body:any={};try{body=text?JSON.parse(text):{}}catch{body={raw:text}}
  const correlationId=res.headers.get('x-correlationid')||res.headers.get('x-correlation-id')||''
  if(!res.ok){back.searchParams.set('error',body?.message||body?.code||`HMRC ${res.status}`);if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)}
  back.searchParams.set('bsasTriggered','1');back.searchParams.set('businessId',businessId);back.searchParams.set('businessType',typeOfBusiness)
  if(body?.calculationId)back.searchParams.set('calculationId',body.calculationId)
  if(correlationId)back.searchParams.set('correlationId',correlationId)
  return NextResponse.redirect(back,303)
 }catch(e:any){back.searchParams.set('error',e.message||'Could not generate HMRC adjustable summary');return NextResponse.redirect(back,303)}
}
