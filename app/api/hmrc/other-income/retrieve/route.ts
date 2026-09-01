import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hmrcApiBase } from '@/lib/hmrc'
import { getValidHmrcAccessToken } from '@/lib/hmrc-connection'
import { markYearEndReviewed } from '@/lib/year-end-review'
import { isSameOriginRequest } from '@/lib/request-security'
import { recordHmrcResponse } from '@/lib/hmrc-response-audit'

async function handle(req:Request,source:URLSearchParams|FormData){
 if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
 const taxpayerId=String(source.get('taxpayerId')||'demo');const taxYear=String(source.get('taxYear')||'')
 const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/end-of-year/other-income`,req.url);back.searchParams.set('taxYear',taxYear)
 if(!/^20\d{2}-\d{2}$/.test(taxYear)){back.searchParams.set('error','Select a valid HMRC tax year');return NextResponse.redirect(back,303)}
 const db=supabaseAdmin();const {data:taxpayer}=await db.from('taxpayers').select('nino').eq('id',taxpayerId).maybeSingle();if(!taxpayer?.nino){back.searchParams.set('error','Taxpayer NINO is missing');return NextResponse.redirect(back,303)}
 let token:string;try{token=await getValidHmrcAccessToken(taxpayerId)}catch(e:any){back.searchParams.set('error',e.message||'HMRC connection is incomplete');return NextResponse.redirect(back,303)}
 const endpoint=`/individuals/other-income/${encodeURIComponent(taxpayer.nino)}/${encodeURIComponent(taxYear)}`
 try{const res=await fetch(`${hmrcApiBase}${endpoint}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.hmrc.3.0+json',...(process.env.HMRC_ENVIRONMENT==='production'?{}:{'Gov-Test-Scenario':'STATEFUL'})},cache:'no-store'});const text=await res.text();let payload:any={};try{payload=text?JSON.parse(text):{}}catch{payload={raw:text}}const correlationId=res.headers.get('x-correlationid')||res.headers.get('x-correlation-id')||'';const retrievalId=await recordHmrcResponse(db,{taxpayerId,taxYear,eventType:'other_income_retrieval',status:res.ok?'accepted':'rejected',payload,correlationId,hmrcStatus:res.status});if(!res.ok){back.searchParams.set('error',res.status===404?'No HMRC other income record was found for this tax year.':(payload?.message||payload?.code||`HMRC ${res.status}`));if(retrievalId)back.searchParams.set('retrievalId',retrievalId);if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)}await markYearEndReviewed(taxpayerId,taxYear,'other-income','Retrieved Other Income from HMRC');back.searchParams.set('retrieved','1');if(retrievalId)back.searchParams.set('retrievalId',retrievalId);if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)}catch(e:any){back.searchParams.set('error',e.message||'Could not retrieve HMRC other income');return NextResponse.redirect(back,303)}
}

export async function GET(req:Request){return handle(req,new URL(req.url).searchParams)}
export async function POST(req:Request){return handle(req,await req.formData())}
