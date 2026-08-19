import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hmrcApiBase } from '@/lib/hmrc'
import { getValidHmrcAccessToken } from '@/lib/hmrc-connection'
import { buildFraudHeaders } from '@/lib/hmrc-fraud'

function num(form:FormData,key:string){const raw=String(form.get(key)||'').trim();if(!raw)return undefined;const n=Number(raw);return Number.isFinite(n)&&n>=0?n:undefined}
function text(form:FormData,key:string){const v=String(form.get(key)||'').trim();return v||undefined}
function clean(obj:any):any{if(Array.isArray(obj))return obj.map(clean);if(obj&&typeof obj==='object')return Object.fromEntries(Object.entries(obj).filter(([,v])=>v!==undefined).map(([k,v])=>[k,clean(v)]));return obj}

export async function POST(req:Request){
 const form=await req.formData();const taxpayerId=String(form.get('taxpayerId')||'demo');const taxYear=String(form.get('taxYear')||'')
 const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/end-of-year/other-income`,req.url);back.searchParams.set('taxYear',taxYear)
 if(!/^20\d{2}-\d{2}$/.test(taxYear)){back.searchParams.set('error','Select a valid HMRC tax year');return NextResponse.redirect(back,303)}
 const postAmount=num(form,'postCessationAmount');const postTaxYear=text(form,'postCessationTaxYear');
 const businessGross=num(form,'businessReceiptGross');const businessTaxYear=text(form,'businessReceiptTaxYear');
 const gainAmount=num(form,'overseasGainAmount');const omittedAmount=num(form,'omittedForeignIncomeAmount')
 const payload:any={}
 if(postAmount!==undefined||postTaxYear){if(postAmount===undefined||!postTaxYear){back.searchParams.set('error','Post cessation receipts require both amount and tax year to be taxed.');return NextResponse.redirect(back,303)}payload.postCessationReceipts=[clean({customerReference:text(form,'postCustomerReference'),businessName:text(form,'postBusinessName'),dateBusinessCeased:text(form,'dateBusinessCeased'),businessDescription:text(form,'businessDescription'),incomeSource:text(form,'postIncomeSource'),amount:postAmount,taxYearIncomeToBeTaxed:postTaxYear})]}
 if(businessGross!==undefined||businessTaxYear){if(businessGross===undefined||!businessTaxYear){back.searchParams.set('error','Business receipts require both gross amount and tax year.');return NextResponse.redirect(back,303)}payload.businessReceipts=[{grossAmount:businessGross,taxYear:businessTaxYear}]}
 if(gainAmount!==undefined)payload.overseasIncomeAndGains={gainAmount}
 if(omittedAmount!==undefined)payload.omittedForeignIncome={amount:omittedAmount}
 if(Object.keys(payload).length===0){back.searchParams.set('error','Enter at least one Other Income item before submitting.');return NextResponse.redirect(back,303)}
 const {data:taxpayer}=await supabaseAdmin().from('taxpayers').select('nino').eq('id',taxpayerId).maybeSingle();if(!taxpayer?.nino){back.searchParams.set('error','Taxpayer NINO is missing');return NextResponse.redirect(back,303)}
 let token:string;try{token=await getValidHmrcAccessToken(taxpayerId)}catch(e:any){back.searchParams.set('error',e.message||'HMRC connection is incomplete');return NextResponse.redirect(back,303)}
 const fraud=buildFraudHeaders(req,form,taxpayerId);if(fraud.missing.length){back.searchParams.set('error',`Missing HMRC fraud prevention data: ${fraud.missing.join(', ')}`);return NextResponse.redirect(back,303)}
 try{
  const res=await fetch(`${hmrcApiBase}/individuals/other-income/${encodeURIComponent(taxpayer.nino)}/${encodeURIComponent(taxYear)}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.hmrc.3.0+json','Content-Type':'application/json',...(process.env.HMRC_ENVIRONMENT==='production'?{}:{'Gov-Test-Scenario':'DEFAULT'}),...fraud.headers},body:JSON.stringify(payload),cache:'no-store'})
  const body=await res.text();let data:any={};try{data=body?JSON.parse(body):{}}catch{data={raw:body}}const correlationId=res.headers.get('x-correlationid')||res.headers.get('x-correlation-id')||''
  if(!res.ok){back.searchParams.set('error',data?.message||data?.code||`HMRC ${res.status}`);if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)}
  back.searchParams.set('saved','1');if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)
 }catch(e:any){back.searchParams.set('error',e.message||'Could not submit HMRC Other Income');return NextResponse.redirect(back,303)}
}
