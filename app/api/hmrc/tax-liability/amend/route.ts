import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hmrcApiBase } from '@/lib/hmrc'
import { getValidHmrcAccessToken } from '@/lib/hmrc-connection'
import { buildFraudHeaders } from '@/lib/hmrc-fraud'
import { isSameOriginRequest } from '@/lib/request-security'

function amount(form:FormData,key:string){const raw=String(form.get(key)||'').trim();if(!raw)return undefined;const n=Number(raw);return Number.isFinite(n)?n:undefined}
function clean(obj:any):any{if(obj&&typeof obj==='object'&&!Array.isArray(obj))return Object.fromEntries(Object.entries(obj).filter(([,v])=>v!==undefined).map(([k,v])=>[k,clean(v)]));return obj}
function ended(taxYear:string){const y=Number(taxYear.slice(0,4));return new Date()>new Date(`${y+1}-04-05T23:59:59Z`)}
async function reviewed(taxpayerId:string,taxYear:string){await supabaseAdmin().from('mtd_year_end_reviews').upsert({taxpayer_id:taxpayerId,tax_year:taxYear,schedule_key:'tax_liability',status:'reviewed',notes:'Tax liability adjustments submitted successfully to HMRC.',reviewed_at:new Date().toISOString()},{onConflict:'taxpayer_id,tax_year,schedule_key'})}

export async function POST(req:Request){
 if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
 const form=await req.formData();const taxpayerId=String(form.get('taxpayerId')||'demo');const taxYear=String(form.get('taxYear')||'')
 const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/end-of-year/tax-liability`,req.url);back.searchParams.set('taxYear',taxYear)
 if(!/^20\d{2}-\d{2}$/.test(taxYear)){back.searchParams.set('error','Select a valid HMRC tax year');return NextResponse.redirect(back,303)}
 if(process.env.HMRC_ENVIRONMENT==='production'&&!ended(taxYear)){back.searchParams.set('error','Tax liability adjustments can only be submitted after the tax year has ended.');return NextResponse.redirect(back,303)}
 const payload=clean({carryBackLossesDecrease:{incomeTax:amount(form,'incomeTax'),class4:amount(form,'class4'),capitalGainsTax:amount(form,'capitalGainsTax')},taxRefundedOrSetOff:{amount:amount(form,'taxRefundedOrSetOff')}})
 const cb=payload.carryBackLossesDecrease||{};if(Object.keys(cb).length===0)delete payload.carryBackLossesDecrease;if(payload.taxRefundedOrSetOff&&Object.keys(payload.taxRefundedOrSetOff).length===0)delete payload.taxRefundedOrSetOff
 if(Object.keys(payload).length===0){back.searchParams.set('error','Enter at least one tax liability adjustment');return NextResponse.redirect(back,303)}
 const {data:taxpayer}=await supabaseAdmin().from('taxpayers').select('nino').eq('id',taxpayerId).maybeSingle();if(!taxpayer?.nino){back.searchParams.set('error','Taxpayer NINO is missing');return NextResponse.redirect(back,303)}
 let token:string;try{token=await getValidHmrcAccessToken(taxpayerId)}catch(e:any){back.searchParams.set('error',e.message||'HMRC connection is incomplete');return NextResponse.redirect(back,303)}
 const fraud=buildFraudHeaders(req,form,taxpayerId);if(fraud.missing.length){back.searchParams.set('error',`Missing HMRC fraud prevention data: ${fraud.missing.join(', ')}`);return NextResponse.redirect(back,303)}
 try{const res=await fetch(`${hmrcApiBase}/individuals/tax-liability/adjustments/${encodeURIComponent(taxpayer.nino)}/${encodeURIComponent(taxYear)}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.hmrc.1.0+json','Content-Type':'application/json',...(process.env.HMRC_ENVIRONMENT==='production'?{}:{'Gov-Test-Scenario':'DEFAULT'}),...fraud.headers},body:JSON.stringify(payload),cache:'no-store'});const text=await res.text();let data:any={};try{data=text?JSON.parse(text):{}}catch{data={raw:text}}const correlationId=res.headers.get('x-correlationid')||res.headers.get('x-correlation-id')||'';if(!res.ok){back.searchParams.set('error',data?.message||data?.code||`HMRC ${res.status}`);if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)}await reviewed(taxpayerId,taxYear);back.searchParams.set('saved','1');if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)}catch(e:any){back.searchParams.set('error',e.message||'Could not submit HMRC tax liability adjustments');return NextResponse.redirect(back,303)}
}
