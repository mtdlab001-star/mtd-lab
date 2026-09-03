import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hmrcApiBase } from '@/lib/hmrc'
import { getHmrcAccessTokenForActingCapacity } from '@/lib/hmrc-connection'
import { hmrcAcceptHeader } from '@/lib/hmrc-api-versions'
import { buildFraudHeaders } from '@/lib/hmrc-fraud'
import { isSameOriginRequest } from '@/lib/request-security'
import { agentCan } from '@/lib/agent-authorisation'
import { currentWorkspace } from '@/lib/workspace'

async function handle(req:Request,source:FormData){
 if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
 const workspace=await currentWorkspace();if(!workspace)return new NextResponse('Accounting workspace access is not available',{status:403})
 const taxpayerId=String(source.get('taxpayerId')||'demo');const taxYear=String(source.get('taxYear')||'');const calculationId=String(source.get('calculationId')||'');const actingAgentId=String(source.get('actingAgentId')||'').trim()||null
 const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/calculations`,req.url);back.searchParams.set('taxYear',taxYear);back.searchParams.set('calculationId',calculationId)
 if(!/^20\d{2}-\d{2}$/.test(taxYear)||!calculationId){back.searchParams.set('error','Tax year and calculation ID are required');return NextResponse.redirect(back,303)}
 const db=supabaseAdmin();const {data:taxpayer}=await db.from('taxpayers').select('nino').eq('id',taxpayerId).eq('firm_id',workspace.firmId).maybeSingle();if(!taxpayer?.nino){back.searchParams.set('error','Taxpayer is not available in this accounting workspace or has no NINO');return NextResponse.redirect(back,303)}
 if(actingAgentId){const allowed=await agentCan(taxpayerId,actingAgentId,'can_submit_final_declaration');if(!allowed){back.searchParams.set('error','The selected agent is not currently authorised to retrieve HMRC calculations for this taxpayer.');return NextResponse.redirect(back,303)}}
 let token:string;try{token=await getHmrcAccessTokenForActingCapacity(taxpayerId,actingAgentId)}catch(e:any){back.searchParams.set('error',e.message||'HMRC connection is incomplete');return NextResponse.redirect(back,303)}
 const fraud=buildFraudHeaders(req,source,taxpayerId);if(fraud.missing.length){back.searchParams.set('error',`Missing HMRC fraud prevention data: ${fraud.missing.join(', ')}`);return NextResponse.redirect(back,303)}
 const endpoint=`/individuals/calculations/${encodeURIComponent(taxpayer.nino)}/self-assessment/${encodeURIComponent(taxYear)}/${encodeURIComponent(calculationId)}`
 try{
  const res=await fetch(`${hmrcApiBase}${endpoint}`,{headers:{Authorization:`Bearer ${token}`,Accept:hmrcAcceptHeader('individualCalculations'),...(process.env.HMRC_ENVIRONMENT==='production'?{}:{'Gov-Test-Scenario':'DYNAMIC'}),...fraud.headers},cache:'no-store'})
  const text=await res.text();let payload:any={};try{payload=text?JSON.parse(text):{}}catch{payload={raw:text}}
  const correlationId=res.headers.get('x-correlationid')||res.headers.get('x-correlation-id')||''
  const {error:auditError}=await db.from('mtd_submission_audit').insert({firm_id:workspace.firmId,taxpayer_id:taxpayerId,tax_year:taxYear,event_type:'tax_calculation_retrieval',status:res.ok?'accepted':'rejected',calculation_id:calculationId,hmrc_correlation_id:correlationId||null,hmrc_status:res.status,acting_agent_id:actingAgentId,response_summary:payload,created_at:new Date().toISOString()});if(auditError)console.error('Calculation retrieval audit failed',auditError.message)
  if(!res.ok){back.searchParams.set('error',res.status===404?'HMRC calculation is not ready yet. Wait a few seconds and retrieve again.':(payload?.message||payload?.code||`HMRC ${res.status}`));if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)}
  back.searchParams.set('retrieved','1');if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)
 }catch(e:any){back.searchParams.set('error',e.message||'Could not retrieve HMRC tax calculation');return NextResponse.redirect(back,303)}
}

export async function GET(){return new NextResponse('Method Not Allowed',{status:405,headers:{Allow:'POST'}})}
export async function POST(req:Request){return handle(req,await req.formData())}
