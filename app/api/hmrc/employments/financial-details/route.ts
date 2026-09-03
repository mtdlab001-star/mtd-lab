import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hmrcApiBase } from '@/lib/hmrc'
import { getValidHmrcAccessToken } from '@/lib/hmrc-connection'
import { isSameOriginRequest } from '@/lib/request-security'
import { recordHmrcResponse } from '@/lib/hmrc-response-audit'
import { buildFraudHeaders } from '@/lib/hmrc-fraud'
import { currentWorkspace } from '@/lib/workspace'

function asFormData(source:URLSearchParams){const form=new FormData();source.forEach((value,key)=>form.set(key,value));return form}

export async function GET(req:Request){
 if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
 const workspace=await currentWorkspace();if(!workspace)return new NextResponse('Accounting workspace access is not available',{status:403})
 const url=new URL(req.url);const taxpayerId=String(url.searchParams.get('taxpayerId')||'demo');const taxYear=String(url.searchParams.get('taxYear')||'');const employmentId=String(url.searchParams.get('employmentId')||'')
 const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/end-of-year/employment`,req.url);back.searchParams.set('taxYear',taxYear)
 if(!/^20\d{2}-\d{2}$/.test(taxYear)||!employmentId){back.searchParams.set('error','A valid tax year and employment ID are required');return NextResponse.redirect(back,303)}
 const db=supabaseAdmin();const {data:taxpayer}=await db.from('taxpayers').select('nino').eq('id',taxpayerId).eq('firm_id',workspace.firmId).maybeSingle();if(!taxpayer?.nino){back.searchParams.set('error','Taxpayer is not available in this accounting workspace or has no NINO');return NextResponse.redirect(back,303)}
 let token:string;try{token=await getValidHmrcAccessToken(taxpayerId)}catch(e:any){back.searchParams.set('error',e.message||'HMRC connection is incomplete');return NextResponse.redirect(back,303)}
 const fraud=buildFraudHeaders(req,asFormData(url.searchParams),taxpayerId);if(fraud.missing.length){back.searchParams.set('error',`Missing HMRC fraud prevention data: ${fraud.missing.join(', ')}`);return NextResponse.redirect(back,303)}
 const endpoint=`/individuals/employments-income/${encodeURIComponent(taxpayer.nino)}/${encodeURIComponent(taxYear)}/${encodeURIComponent(employmentId)}/financial-details`
 try{const res=await fetch(`${hmrcApiBase}${endpoint}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.hmrc.2.0+json',...(process.env.HMRC_ENVIRONMENT==='production'?{}:{'Gov-Test-Scenario':'DEFAULT'}),...fraud.headers},cache:'no-store'});const text=await res.text();let payload:any={};try{payload=text?JSON.parse(text):{}}catch{payload={raw:text}}const correlationId=res.headers.get('x-correlationid')||res.headers.get('x-correlation-id')||'';const retrievalId=await recordHmrcResponse(db,{taxpayerId,taxYear,eventType:'employment_financial_retrieval',status:res.ok?'accepted':'rejected',payload,correlationId,hmrcStatus:res.status,requestSummary:{employmentId}});if(!res.ok){back.searchParams.set('error',res.status===404?'No financial details were found for this employment.':(payload?.message||payload?.code||`HMRC ${res.status}`));if(retrievalId)back.searchParams.set('retrievalId',retrievalId);if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)}back.searchParams.set('employmentId',employmentId);back.searchParams.set('financial','1');if(retrievalId)back.searchParams.set('retrievalId',retrievalId);if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)}catch(e:any){back.searchParams.set('error',e.message||'Could not retrieve employment financial details');return NextResponse.redirect(back,303)}
}
