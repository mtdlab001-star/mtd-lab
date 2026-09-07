import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hmrcApiBase } from '@/lib/hmrc'
import { getHmrcAccessTokenForActingCapacity } from '@/lib/hmrc-connection'
import { buildFraudHeaders } from '@/lib/hmrc-fraud'
import { hmrcAcceptHeader } from '@/lib/hmrc-api-versions'
import { isSameOriginRequest } from '@/lib/request-security'
import { agentCan } from '@/lib/agent-authorisation'
import { yearEndFinalisationStatus } from '@/lib/year-end-finalisation'
import { currentWorkspace } from '@/lib/workspace'

function taxYearPeriod(taxYear:string){const startYear=Number(taxYear.slice(0,4));return {from:`${startYear}-04-06`,to:`${startYear+1}-04-05`}}

export async function POST(req:Request){
 if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
 const workspace=await currentWorkspace();if(!workspace)return new NextResponse('Accounting workspace access is not available',{status:403})
 const form=await req.formData();const taxpayerId=String(form.get('taxpayerId')||'demo');const taxYear=String(form.get('taxYear')||'');const calculationId=String(form.get('calculationId')||'');const actingAgentId=String(form.get('actingAgentId')||'').trim()||null;const declarationConfirmed=String(form.get('declarationConfirmed')||'')==='yes'
 const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/calculations`,req.url);back.searchParams.set('taxYear',taxYear);if(calculationId)back.searchParams.set('calculationId',calculationId);if(actingAgentId)back.searchParams.set('actingAgentId',actingAgentId)
 if(!/^20\d{2}-\d{2}$/.test(taxYear)){back.searchParams.set('error','Select a valid HMRC tax year');return NextResponse.redirect(back,303)}
 if(!calculationId){back.searchParams.set('error','HMRC calculation ID is missing');return NextResponse.redirect(back,303)}
 if(!declarationConfirmed){back.searchParams.set('error','Confirm the declaration before submitting the Income Tax return');return NextResponse.redirect(back,303)}
 const db=supabaseAdmin();const {data:taxpayer}=await db.from('taxpayers').select('nino').eq('id',taxpayerId).eq('firm_id',workspace.firmId).maybeSingle();if(!taxpayer?.nino){back.searchParams.set('error','Taxpayer is not available in this accounting workspace or has no NINO');return NextResponse.redirect(back,303)}
 if(actingAgentId){const allowed=await agentCan(taxpayerId,actingAgentId,'can_submit_final_declaration');if(!allowed){back.searchParams.set('error','The selected agent is not currently authorised to submit the Final Declaration for this taxpayer.');return NextResponse.redirect(back,303)}}
 const period=taxYearPeriod(taxYear)
 const [{count:businessCount},{data:obligations},{data:reviews}]=await Promise.all([
  db.from('hmrc_businesses').select('id',{count:'exact',head:true}).eq('firm_id',workspace.firmId).eq('taxpayer_id',taxpayerId),
  db.from('hmrc_obligations').select('period_start,period_end,status').eq('firm_id',workspace.firmId).eq('taxpayer_id',taxpayerId).gte('period_start',period.from).lte('period_end',period.to),
  db.from('mtd_year_end_reviews').select('section,status').eq('firm_id',workspace.firmId).eq('taxpayer_id',taxpayerId).eq('tax_year',taxYear),
 ])
 const readiness=yearEndFinalisationStatus({taxYear,businessCount:businessCount||0,obligations:obligations||[],reviews:reviews||[]})
 if(!readiness.canFinalise){back.searchParams.set('error',`Final Declaration is blocked: ${readiness.blockers.join('. ')}.`);return NextResponse.redirect(back,303)}
 let token:string;try{token=await getHmrcAccessTokenForActingCapacity(taxpayerId,actingAgentId)}catch(e:any){back.searchParams.set('error',e.message||'HMRC connection is incomplete');return NextResponse.redirect(back,303)}
 const fraud=buildFraudHeaders(req,form,taxpayerId);if(fraud.missing.length){back.searchParams.set('error',`Missing HMRC fraud prevention data: ${fraud.missing.join(', ')}`);return NextResponse.redirect(back,303)}
 const endpoint=`/individuals/calculations/${encodeURIComponent(taxpayer.nino)}/self-assessment/${encodeURIComponent(taxYear)}/${encodeURIComponent(calculationId)}/final-declaration`
 try{
  const res=await fetch(`${hmrcApiBase}${endpoint}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,Accept:hmrcAcceptHeader('individualCalculations'),...fraud.headers},cache:'no-store'})
  const text=await res.text();let payload:any={};try{payload=text?JSON.parse(text):{}}catch{payload={raw:text}}
  const correlationId=res.headers.get('x-correlationid')||res.headers.get('x-correlation-id')||''
  const {error:auditError}=await db.from('mtd_submission_audit').insert({firm_id:workspace.firmId,taxpayer_id:taxpayerId,tax_year:taxYear,event_type:'final_declaration',status:res.ok?'accepted':'rejected',calculation_id:calculationId,hmrc_correlation_id:correlationId||null,hmrc_status:res.status,acting_agent_id:actingAgentId,request_summary:{actingCapacity:actingAgentId?'agent':'direct',declarationConfirmed:true},response_summary:payload,response_payload:payload,created_at:new Date().toISOString()});if(auditError)console.error('Final Declaration audit failed',auditError.message)
  if(!res.ok){back.searchParams.set('error',payload?.message||payload?.code||`HMRC ${res.status}`);if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)}
  back.searchParams.set('submitted','1');if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)
 }catch(e:any){back.searchParams.set('error',e.message||'Could not submit the Income Tax return declaration');return NextResponse.redirect(back,303)}
}
