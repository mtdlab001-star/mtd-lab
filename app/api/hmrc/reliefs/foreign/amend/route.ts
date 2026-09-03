import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hmrcApiBase } from '@/lib/hmrc'
import { getValidHmrcAccessToken } from '@/lib/hmrc-connection'
import { buildFraudHeaders } from '@/lib/hmrc-fraud'
import { markYearEndReviewed } from '@/lib/year-end-review'
import { isSameOriginRequest } from '@/lib/request-security'
import { taxYearHasEnded } from '@/lib/year-end-finalisation'
import { currentWorkspace } from '@/lib/workspace'
import { recordHmrcResponse } from '@/lib/hmrc-response-audit'

function num(form:FormData,key:string){const raw=String(form.get(key)||'').trim();if(!raw)return undefined;const n=Number(raw);return Number.isFinite(n)&&n>=0?n:undefined}
function text(form:FormData,key:string){const v=String(form.get(key)||'').trim();return v||undefined}

export async function POST(req:Request){
 if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
 const workspace=await currentWorkspace();if(!workspace)return new NextResponse('Accounting workspace access is not available',{status:403})
 const form=await req.formData();const taxpayerId=String(form.get('taxpayerId')||'demo');const taxYear=String(form.get('taxYear')||'')
 const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/end-of-year/reliefs`,req.url);back.searchParams.set('taxYear',taxYear);back.searchParams.set('type','foreign')
 if(!/^20\d{2}-\d{2}$/.test(taxYear)){back.searchParams.set('error','Select a valid HMRC tax year');return NextResponse.redirect(back,303)}
 if(!taxYearHasEnded(taxYear)){back.searchParams.set('error','Relief figures can be prepared now, but HMRC submission is locked until the selected tax year has ended.');return NextResponse.redirect(back,303)}
 if(process.env.HMRC_ENVIRONMENT==='production'&&process.env.HMRC_ALLOW_PRODUCTION_SUBMISSIONS!=='true'){back.searchParams.set('error','Production HMRC submissions are locked until explicitly enabled.');return NextResponse.redirect(back,303)}
 const ftcrAmount=num(form,'foreignTaxCreditReliefAmount');const countryCode=text(form,'countryCode')?.toUpperCase();const taxableAmount=num(form,'taxableAmount');const foreignTaxPaid=num(form,'foreignTaxPaid');const employmentLumpSum=String(form.get('employmentLumpSum')||'false')==='true';const notClaimed=num(form,'foreignTaxForFtcrNotClaimedAmount')
 const payload:any={}
 if(ftcrAmount!==undefined)payload.foreignTaxCreditRelief={amount:ftcrAmount}
 const hasCountryRow=countryCode||taxableAmount!==undefined||foreignTaxPaid!==undefined||form.has('employmentLumpSum')
 if(hasCountryRow){if(!countryCode||!/^[A-Z]{3}$/.test(countryCode)||taxableAmount===undefined){back.searchParams.set('error','Foreign income tax credit relief requires a 3 letter country code and taxable amount.');return NextResponse.redirect(back,303)}payload.foreignIncomeTaxCreditRelief=[{countryCode,taxableAmount,employmentLumpSum,...(foreignTaxPaid===undefined?{}:{foreignTaxPaid})}]}
 if(notClaimed!==undefined)payload.foreignTaxForFtcrNotClaimed={amount:notClaimed}
 if(Object.keys(payload).length===0){back.searchParams.set('error','Enter at least one Foreign Relief amount');return NextResponse.redirect(back,303)}
 const db=supabaseAdmin();const {data:taxpayer}=await db.from('taxpayers').select('nino').eq('id',taxpayerId).eq('firm_id',workspace.firmId).maybeSingle();if(!taxpayer?.nino){back.searchParams.set('error','Taxpayer is not available in this accounting workspace or has no NINO');return NextResponse.redirect(back,303)}
 let token:string;try{token=await getValidHmrcAccessToken(taxpayerId)}catch(e:any){back.searchParams.set('error',e.message||'HMRC connection is incomplete');return NextResponse.redirect(back,303)}
 const fraud=buildFraudHeaders(req,form,taxpayerId);if(fraud.missing.length){back.searchParams.set('error',`Missing HMRC fraud prevention data: ${fraud.missing.join(', ')}`);return NextResponse.redirect(back,303)}
 try{const res=await fetch(`${hmrcApiBase}/individuals/reliefs/foreign/${encodeURIComponent(taxpayer.nino)}/${encodeURIComponent(taxYear)}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.hmrc.3.0+json','Content-Type':'application/json',...(process.env.HMRC_ENVIRONMENT==='production'?{}:{'Gov-Test-Scenario':'DEFAULT'}),...fraud.headers},body:JSON.stringify(payload),cache:'no-store'});const raw=await res.text();let data:any={};try{data=raw?JSON.parse(raw):{}}catch{data={raw}}const correlationId=res.headers.get('x-correlationid')||res.headers.get('x-correlation-id')||'';const auditId=await recordHmrcResponse(db,{taxpayerId,taxYear,eventType:'reliefs_foreign_amendment',status:res.ok?'accepted':'rejected',payload:data,correlationId,hmrcStatus:res.status,requestSummary:{type:'foreign'}});if(auditId)back.searchParams.set('auditId',auditId);if(!res.ok){back.searchParams.set('error',data?.message||data?.code||`HMRC ${res.status}`);if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)}await markYearEndReviewed(taxpayerId,taxYear,'reliefs','Foreign reliefs updated in HMRC');back.searchParams.set('savedForeign','1');if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)}catch(e:any){back.searchParams.set('error',e.message||'Could not submit foreign reliefs');return NextResponse.redirect(back,303)}
}
