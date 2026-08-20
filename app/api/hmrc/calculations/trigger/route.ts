import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hmrcApiBase } from '@/lib/hmrc'
import { getValidHmrcAccessToken } from '@/lib/hmrc-connection'
import { buildFraudHeaders } from '@/lib/hmrc-fraud'
import { hmrcAcceptHeader } from '@/lib/hmrc-api-versions'

export async function POST(req:Request){
 const form=await req.formData();const taxpayerId=String(form.get('taxpayerId')||'demo');const taxYear=String(form.get('taxYear')||'');const calculationType=String(form.get('calculationType')||'in-year')
 const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/calculations`,req.url);back.searchParams.set('taxYear',taxYear)
 if(!/^20\d{2}-\d{2}$/.test(taxYear)){back.searchParams.set('error','Select a valid HMRC tax year');return NextResponse.redirect(back,303)}
 if(!['in-year','intent-to-finalise','intent-to-amend'].includes(calculationType)){back.searchParams.set('error','Invalid HMRC calculation type');return NextResponse.redirect(back,303)}
 const db=supabaseAdmin();const {data:taxpayer}=await db.from('taxpayers').select('nino').eq('id',taxpayerId).maybeSingle();if(!taxpayer?.nino){back.searchParams.set('error','Taxpayer NINO is missing');return NextResponse.redirect(back,303)}
 let token:string;try{token=await getValidHmrcAccessToken(taxpayerId)}catch(e:any){back.searchParams.set('error',e.message||'HMRC connection is incomplete');return NextResponse.redirect(back,303)}
 const fraud=buildFraudHeaders(req,form,taxpayerId);if(fraud.missing.length){back.searchParams.set('error',`Missing HMRC fraud prevention data: ${fraud.missing.join(', ')}`);return NextResponse.redirect(back,303)}
 const endpoint=`/individuals/calculations/${encodeURIComponent(taxpayer.nino)}/self-assessment/${encodeURIComponent(taxYear)}/trigger/${encodeURIComponent(calculationType)}`
 try{
  const res=await fetch(`${hmrcApiBase}${endpoint}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,Accept:hmrcAcceptHeader('individualCalculations'),...(process.env.HMRC_ENVIRONMENT==='production'?{}:{'Gov-Test-Scenario':'DEFAULT'}),...fraud.headers},cache:'no-store'})
  const text=await res.text();let payload:any={};try{payload=text?JSON.parse(text):{}}catch{payload={raw:text}}
  const correlationId=res.headers.get('x-correlationid')||res.headers.get('x-correlation-id')||'';const calculationId=String(payload?.calculationId||'')
  const {error:auditError}=await db.from('mtd_submission_audit').insert({taxpayer_id:taxpayerId,tax_year:taxYear,event_type:'tax_calculation_trigger',status:res.ok?'accepted':'rejected',calculation_id:calculationId||null,hmrc_correlation_id:correlationId||null,hmrc_status:res.status,request_summary:{calculationType},response_summary:payload,created_at:new Date().toISOString()});if(auditError)console.error('Calculation trigger audit failed',auditError.message)
  if(!res.ok){back.searchParams.set('error',payload?.message||payload?.code||`HMRC ${res.status}`);if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)}
  if(calculationId)back.searchParams.set('calculationId',calculationId);back.searchParams.set('triggered','1');if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)
 }catch(e:any){back.searchParams.set('error',e.message||'Could not trigger HMRC tax calculation');return NextResponse.redirect(back,303)}
}
