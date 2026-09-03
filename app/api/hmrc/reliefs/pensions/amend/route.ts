import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hmrcApiBase } from '@/lib/hmrc'
import { getValidHmrcAccessToken } from '@/lib/hmrc-connection'
import { buildFraudHeaders } from '@/lib/hmrc-fraud'
import { markYearEndReviewed } from '@/lib/year-end-review'
import { isSameOriginRequest } from '@/lib/request-security'
import { currentWorkspace } from '@/lib/workspace'
import { taxYearHasEnded } from '@/lib/year-end-finalisation'

function num(form:FormData,key:string){const raw=String(form.get(key)||'').trim();if(!raw)return undefined;const n=Number(raw);return Number.isFinite(n)&&n>=0?n:undefined}
function clean(obj:any):any{if(obj&&typeof obj==='object'&&!Array.isArray(obj))return Object.fromEntries(Object.entries(obj).filter(([,v])=>v!==undefined).map(([k,v])=>[k,clean(v)]));return obj}

export async function POST(req:Request){
 if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
 const workspace=await currentWorkspace();if(!workspace)return new NextResponse('Accounting workspace access is not available',{status:403})
 const form=await req.formData();const taxpayerId=String(form.get('taxpayerId')||'demo');const taxYear=String(form.get('taxYear')||'')
 const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/end-of-year/reliefs`,req.url);back.searchParams.set('taxYear',taxYear);back.searchParams.set('type','pensions')
 if(!/^20\d{2}-\d{2}$/.test(taxYear)){back.searchParams.set('error','Select a valid HMRC tax year');return NextResponse.redirect(back,303)}
 if(!taxYearHasEnded(taxYear)){back.searchParams.set('error','Relief figures can be prepared now, but HMRC submission is locked until the selected tax year has ended.');return NextResponse.redirect(back,303)}
 if(process.env.HMRC_ENVIRONMENT==='production'&&process.env.HMRC_ALLOW_PRODUCTION_SUBMISSIONS!=='true'){back.searchParams.set('error','Production HMRC submissions are locked until explicitly enabled.');return NextResponse.redirect(back,303)}
 const payload=clean({pensionReliefs:{regularPensionContributions:num(form,'regularPensionContributions'),oneOffPensionContributionsPaid:num(form,'oneOffPensionContributionsPaid'),retirementAnnuityPayments:num(form,'retirementAnnuityPayments'),paymentToEmployersSchemeNoTaxRelief:num(form,'paymentToEmployersSchemeNoTaxRelief'),overseasPensionSchemeContributions:num(form,'overseasPensionSchemeContributions')}})
 if(payload.pensionReliefs&&Object.keys(payload.pensionReliefs).length===0)delete payload.pensionReliefs
 if(Object.keys(payload).length===0){back.searchParams.set('error','Enter at least one pension relief amount');return NextResponse.redirect(back,303)}
 const {data:taxpayer}=await supabaseAdmin().from('taxpayers').select('nino').eq('id',taxpayerId).eq('firm_id',workspace.firmId).maybeSingle();if(!taxpayer?.nino){back.searchParams.set('error','Taxpayer is not available in this accounting workspace or has no NINO');return NextResponse.redirect(back,303)}
 let token:string;try{token=await getValidHmrcAccessToken(taxpayerId)}catch(e:any){back.searchParams.set('error',e.message||'HMRC connection is incomplete');return NextResponse.redirect(back,303)}
 const fraud=buildFraudHeaders(req,form,taxpayerId);if(fraud.missing.length){back.searchParams.set('error',`Missing HMRC fraud prevention data: ${fraud.missing.join(', ')}`);return NextResponse.redirect(back,303)}
 try{const res=await fetch(`${hmrcApiBase}/individuals/reliefs/pensions/${encodeURIComponent(taxpayer.nino)}/${encodeURIComponent(taxYear)}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.hmrc.3.0+json','Content-Type':'application/json',...(process.env.HMRC_ENVIRONMENT==='production'?{}:{'Gov-Test-Scenario':'DEFAULT'}),...fraud.headers},body:JSON.stringify(payload),cache:'no-store'});const text=await res.text();let data:any={};try{data=text?JSON.parse(text):{}}catch{data={raw:text}}const correlationId=res.headers.get('x-correlationid')||res.headers.get('x-correlation-id')||'';if(!res.ok){back.searchParams.set('error',data?.message||data?.code||`HMRC ${res.status}`);if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)}await markYearEndReviewed(taxpayerId,taxYear,'reliefs','Pension reliefs updated in HMRC');back.searchParams.set('savedPensions','1');if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)}catch(e:any){back.searchParams.set('error',e.message||'Could not submit pension reliefs');return NextResponse.redirect(back,303)}
}
