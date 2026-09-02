import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hmrcApiBase } from '@/lib/hmrc'
import { getHmrcAccessTokenForActingCapacity } from '@/lib/hmrc-connection'
import { buildFraudHeaders } from '@/lib/hmrc-fraud'
import { hmrcAcceptHeader } from '@/lib/hmrc-api-versions'
import { agentCan } from '@/lib/agent-authorisation'
import { isSameOriginRequest } from '@/lib/request-security'
import { taxYearHasEnded, yearEndFinalisationStatus } from '@/lib/year-end-finalisation'

function taxYearPeriod(taxYear:string){const startYear=Number(taxYear.slice(0,4));return {from:`${startYear}-04-06`,to:`${startYear+1}-04-05`}}

export async function POST(req:Request){
 if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
 const form=await req.formData();const taxpayerId=String(form.get('taxpayerId')||'demo');const taxYear=String(form.get('taxYear')||'');const calculationId=String(form.get('calculationId')||'');const confirmed=String(form.get('declarationConfirmed')||'')==='yes';const actingAgentId=String(form.get('actingAgentId')||'').trim()||null
 const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/calculations`,req.url);back.searchParams.set('taxYear',taxYear);back.searchParams.set('calculationId',calculationId)
 if(!taxYearHasEnded(taxYear)){back.searchParams.set('error','Final Declaration is not available until the selected tax year has ended.');return NextResponse.redirect(back,303)}
 if(!calculationId){back.searchParams.set('error','A completed HMRC calculation is required before Final Declaration.');return NextResponse.redirect(back,303)}
 if(!confirmed){back.searchParams.set('error','Confirm that the Income Tax return information is correct and complete before submitting the declaration.');return NextResponse.redirect(back,303)}
 if(actingAgentId){const allowed=await agentCan(taxpayerId,actingAgentId,'can_submit_final_declaration');if(!allowed){back.searchParams.set('error','The selected agent is not currently authorised to submit the Final Declaration for this taxpayer.');return NextResponse.redirect(back,303)}}
 const period=taxYearPeriod(taxYear)
 const db=supabaseAdmin();const [{data:taxpayer},{count:businessCount},{data:obs},{data:reviews},{data:calcs}]=await Promise.all([db.from('taxpayers').select('nino').eq('id',taxpayerId).maybeSingle(),db.from('hmrc_businesses').select('id',{count:'exact',head:true}).eq('taxpayer_id',taxpayerId),db.from('hmrc_obligations').select('period_start,period_end,status').eq('taxpayer_id',taxpayerId).gte('period_start',period.from).lte('period_end',period.to),db.from('mtd_year_end_reviews').select('section,status').eq('taxpayer_id',taxpayerId).eq('tax_year',taxYear),db.from('mtd_submission_audit').select('id').eq('taxpayer_id',taxpayerId).eq('tax_year',taxYear).eq('event_type','tax_calculation_retrieval').eq('status','accepted').eq('calculation_id',calculationId).limit(1)])
 if(!taxpayer?.nino){back.searchParams.set('error','Taxpayer NINO is missing');return NextResponse.redirect(back,303)}
 if(!calcs?.length){back.searchParams.set('error','Retrieve and check this HMRC calculation before submitting the Income Tax return.');return NextResponse.redirect(back,303)}
 const readiness=yearEndFinalisationStatus({taxYear,businessCount:businessCount||0,obligations:obs||[],reviews:reviews||[]});if(!readiness.canFinalise){back.searchParams.set('error',`Final Declaration is blocked: ${readiness.blockers.join('. ')}.`);return NextResponse.redirect(back,303)}
 if(process.env.HMRC_ENVIRONMENT==='production'&&process.env.HMRC_ALLOW_PRODUCTION_SUBMISSIONS!=='true'){back.searchParams.set('error','Production Final Declaration is locked until production submissions are explicitly enabled.');return NextResponse.redirect(back,303)}
 let token:string;try{token=await getHmrcAccessTokenForActingCapacity(taxpayerId,actingAgentId)}catch(e:any){back.searchParams.set('error',e.message||'HMRC connection is incomplete');return NextResponse.redirect(back,303)}
 const fraud=buildFraudHeaders(req,form,taxpayerId);if(fraud.missing.length){back.searchParams.set('error',`Missing HMRC fraud prevention data: ${fraud.missing.join(', ')}`);return NextResponse.redirect(back,303)}
 const endpoint=`/individuals/calculations/${encodeURIComponent(taxpayer.nino)}/self-assessment/${encodeURIComponent(taxYear)}/${encodeURIComponent(calculationId)}/final-declaration`
 try{const res=await fetch(`${hmrcApiBase}${endpoint}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,Accept:hmrcAcceptHeader('individualCalculations'),...(process.env.HMRC_ENVIRONMENT==='production'?{}:{'Gov-Test-Scenario':'DEFAULT'}),...fraud.headers},cache:'no-store'});const text=await res.text();let payload:any={};try{payload=text?JSON.parse(text):{}}catch{payload={raw:text}}const correlationId=res.headers.get('x-correlationid')||res.headers.get('x-correlation-id')||'';const {error:auditError}=await db.from('mtd_submission_audit').insert({taxpayer_id:taxpayerId,tax_year:taxYear,event_type:'final_declaration',status:res.ok?'accepted':'rejected',hmrc_correlation_id:correlationId||null,calculation_id:calculationId,hmrc_status:res.status,acting_agent_id:actingAgentId,request_summary:{calculationId,declarationConfirmed:true,actingCapacity:actingAgentId?'agent':'direct'},response_summary:payload,created_at:new Date().toISOString()});if(auditError)console.error('Final declaration audit failed',auditError.message);if(!res.ok){back.searchParams.set('error',payload?.message||payload?.code||`HMRC ${res.status}`);if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)}const confirmation=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/calculations/confirmation`,req.url);confirmation.searchParams.set('taxYear',taxYear);confirmation.searchParams.set('calculationId',calculationId);return NextResponse.redirect(confirmation,303)}catch(e:any){back.searchParams.set('error',e.message||'Could not submit Final Declaration');return NextResponse.redirect(back,303)}
}
