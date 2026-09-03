import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hmrcApiBase } from '@/lib/hmrc'
import { getValidHmrcAccessToken } from '@/lib/hmrc-connection'
import { buildFraudHeaders } from '@/lib/hmrc-fraud'
import { isSameOriginRequest } from '@/lib/request-security'
import { recordHmrcResponse } from '@/lib/hmrc-response-audit'
import { currentWorkspace } from '@/lib/workspace'

const allowed:Record<string,string>={investment:'investment',other:'other',foreign:'foreign',pensions:'pensions',charitable:'charitable-giving'}
function asFormData(source:URLSearchParams|FormData){if(source instanceof FormData)return source;const form=new FormData();source.forEach((value,key)=>form.set(key,value));return form}

async function handle(req:Request,source:URLSearchParams|FormData){
 if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
 const workspace=await currentWorkspace();if(!workspace)return new NextResponse('Accounting workspace access is not available',{status:403})
 const taxpayerId=String(source.get('taxpayerId')||'demo');const taxYear=String(source.get('taxYear')||'');const type=String(source.get('type')||'other')
 const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/end-of-year/reliefs`,req.url);back.searchParams.set('taxYear',taxYear);back.searchParams.set('type',type)
 if(!/^20\d{2}-\d{2}$/.test(taxYear)||!allowed[type]){back.searchParams.set('error','Valid tax year and relief type are required');return NextResponse.redirect(back,303)}
 const db=supabaseAdmin();const {data:taxpayer}=await db.from('taxpayers').select('nino').eq('id',taxpayerId).eq('firm_id',workspace.firmId).maybeSingle();if(!taxpayer?.nino){back.searchParams.set('error','Taxpayer is not available in this accounting workspace or has no NINO');return NextResponse.redirect(back,303)}
 let token:string;try{token=await getValidHmrcAccessToken(taxpayerId)}catch(e:any){back.searchParams.set('error',e.message||'HMRC connection is incomplete');return NextResponse.redirect(back,303)}
 const fraud=buildFraudHeaders(req,asFormData(source),taxpayerId);if(fraud.missing.length){back.searchParams.set('error',`Missing HMRC fraud prevention data: ${fraud.missing.join(', ')}`);return NextResponse.redirect(back,303)}
 const endpoint=`/individuals/reliefs/${allowed[type]}/${encodeURIComponent(taxpayer.nino)}/${encodeURIComponent(taxYear)}`
 try{const res=await fetch(`${hmrcApiBase}${endpoint}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.hmrc.3.0+json',...(process.env.HMRC_ENVIRONMENT==='production'?{}:{'Gov-Test-Scenario':'DEFAULT'}),...fraud.headers},cache:'no-store'});const text=await res.text();let payload:any={};try{payload=text?JSON.parse(text):{}}catch{payload={raw:text}}const correlationId=res.headers.get('x-correlationid')||res.headers.get('x-correlation-id')||'';const retrievalId=await recordHmrcResponse(db,{taxpayerId,taxYear,eventType:'reliefs_retrieval',status:res.ok?'accepted':'rejected',payload,correlationId,hmrcStatus:res.status,requestSummary:{type}});if(!res.ok){back.searchParams.set('error',res.status===404?'No HMRC relief data was found for this category.':(payload?.message||payload?.code||`HMRC ${res.status}`));if(retrievalId)back.searchParams.set('retrievalId',retrievalId);if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)}back.searchParams.set('retrieved','1');if(retrievalId)back.searchParams.set('retrievalId',retrievalId);if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)}catch(e:any){back.searchParams.set('error',e.message||'Could not retrieve HMRC reliefs');return NextResponse.redirect(back,303)}
}

export async function GET(req:Request){return handle(req,new URL(req.url).searchParams)}
export async function POST(req:Request){return handle(req,await req.formData())}
