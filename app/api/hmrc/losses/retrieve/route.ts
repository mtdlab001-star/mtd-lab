import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hmrcApiBase } from '@/lib/hmrc'
import { getValidHmrcAccessToken } from '@/lib/hmrc-connection'
import { buildFraudHeaders } from '@/lib/hmrc-fraud'
import { isSameOriginRequest } from '@/lib/request-security'

export async function POST(req:Request){
 if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
 const form=await req.formData()
 const taxpayerId=String(form.get('taxpayerId')||'demo')
 const taxYear=String(form.get('taxYear')||'')
 const businessId=String(form.get('businessId')||'')
 const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/end-of-year/adjustments`,req.url)
 back.searchParams.set('taxYear',taxYear);back.searchParams.set('lossBusinessId',businessId)
 if(!/^20\d{2}-\d{2}$/.test(taxYear)||!businessId){back.searchParams.set('error','Tax year and business are required');return NextResponse.redirect(back,303)}
 const {data:taxpayer}=await supabaseAdmin().from('taxpayers').select('nino').eq('id',taxpayerId).maybeSingle()
 if(!taxpayer?.nino){back.searchParams.set('error','Taxpayer NINO is missing');return NextResponse.redirect(back,303)}
 let token:string
 try{token=await getValidHmrcAccessToken(taxpayerId)}catch(e:any){back.searchParams.set('error',e.message||'HMRC connection is incomplete');return NextResponse.redirect(back,303)}
 const fraud=buildFraudHeaders(req,form,taxpayerId)
 if(fraud.missing.length){back.searchParams.set('error',`Missing HMRC fraud prevention data: ${fraud.missing.join(', ')}`);return NextResponse.redirect(back,303)}
 try{
  const endpoint=`/individuals/losses/${encodeURIComponent(taxpayer.nino)}/businesses/${encodeURIComponent(businessId)}/loss-claims/${encodeURIComponent(taxYear)}`
  const res=await fetch(`${hmrcApiBase}${endpoint}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.hmrc.7.0+json',...(process.env.HMRC_ENVIRONMENT==='production'?{}:{'Gov-Test-Scenario':'DEFAULT'}),...fraud.headers},cache:'no-store'})
  const text=await res.text();let body:any={};try{body=text?JSON.parse(text):{}}catch{body={raw:text}}
  const correlationId=res.headers.get('x-correlationid')||res.headers.get('x-correlation-id')||''
  if(!res.ok){back.searchParams.set('error',res.status===404?'HMRC has no losses or claims recorded for this business and tax year.':(body?.message||body?.code||`HMRC ${res.status}`));if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)}
  back.searchParams.set('lossesRetrieved','1');back.searchParams.set('lossResult',Buffer.from(JSON.stringify(body)).toString('base64url'));if(correlationId)back.searchParams.set('correlationId',correlationId)
  return NextResponse.redirect(back,303)
 }catch(e:any){back.searchParams.set('error',e.message||'Could not retrieve HMRC losses and claims');return NextResponse.redirect(back,303)}
}
