import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hmrcApiBase } from '@/lib/hmrc'
import { getValidHmrcAccessToken } from '@/lib/hmrc-connection'
import { buildFraudHeaders } from '@/lib/hmrc-fraud'

function amount(form:FormData,key:string){const raw=String(form.get(key)||'').trim();if(!raw)return undefined;const n=Number(raw);return Number.isFinite(n)?n:undefined}
function clean(obj:any):any{if(obj&&typeof obj==='object'&&!Array.isArray(obj)){const out:any={};for(const [k,v] of Object.entries(obj)){const c=clean(v);if(c!==undefined&&(typeof c!=='object'||Object.keys(c).length))out[k]=c}return out}return obj}
function yearEnded(taxYear:string){const start=Number(taxYear.slice(0,4));return new Date()>new Date(`${start+1}-04-05T23:59:59Z`)}
async function reviewed(taxpayerId:string,taxYear:string){await supabaseAdmin().from('mtd_year_end_reviews').upsert({taxpayer_id:taxpayerId,tax_year:taxYear,schedule_key:'losses',status:'reviewed',notes:'Losses and claims submitted successfully to HMRC.',reviewed_at:new Date().toISOString()},{onConflict:'taxpayer_id,tax_year,schedule_key'})}

export async function POST(req:Request){
 const form=await req.formData();const taxpayerId=String(form.get('taxpayerId')||'demo');const taxYear=String(form.get('taxYear')||'');const businessId=String(form.get('businessId')||'').trim();const businessType=String(form.get('businessType')||'self-employment')
 const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/end-of-year/adjustments`,req.url);back.searchParams.set('taxYear',taxYear)
 if(!/^20\d{2}-\d{2}$/.test(taxYear)||!businessId){back.searchParams.set('error','Tax year and business ID are required');return NextResponse.redirect(back,303)}
 if(process.env.HMRC_ENVIRONMENT==='production'&&!yearEnded(taxYear)){back.searchParams.set('error','HMRC loss claims can only be created or amended after the tax year has ended');return NextResponse.redirect(back,303)}
 const {data:taxpayer}=await supabaseAdmin().from('taxpayers').select('nino').eq('id',taxpayerId).maybeSingle();if(!taxpayer?.nino){back.searchParams.set('error','Taxpayer NINO is missing');return NextResponse.redirect(back,303)}
 let token:string;try{token=await getValidHmrcAccessToken(taxpayerId)}catch(e:any){back.searchParams.set('error',e.message||'HMRC connection is incomplete');return NextResponse.redirect(back,303)}
 const fraud=buildFraudHeaders(req,form,taxpayerId);if(fraud.missing.length){back.searchParams.set('error',`Missing HMRC fraud prevention data: ${fraud.missing.join(', ')}`);return NextResponse.redirect(back,303)}
 const carryBackPrev=amount(form,'carryBackPreviousYearGeneralIncome');const earlyYear=amount(form,'carryBackEarlyYearLosses');const sideways=amount(form,'carrySidewaysCurrentYearGeneralIncome');const currentForward=amount(form,'carryForwardCurrentYearLosses');const previousForward=amount(form,'carryForwardPreviousYearsLosses');const broughtForward=amount(form,'broughtForwardLosses');const pref=String(form.get('preferenceOrder')||'').trim()
 if(businessType==='uk-property'&&(carryBackPrev!==undefined||earlyYear!==undefined)){back.searchParams.set('error','Carry back claims are not permitted for a UK property income source');return NextResponse.redirect(back,303)}
 const payload=clean({claims:{carryBack:{previousYearGeneralIncome:carryBackPrev,earlyYearLosses:earlyYear},carrySideways:{currentYearGeneralIncome:sideways},preferenceOrder:pref?{applyFirst:pref}:undefined,carryForward:{currentYearLosses:currentForward,previousYearsLosses:previousForward}},losses:{broughtForwardLosses:broughtForward}})
 if(!Object.keys(payload).length){back.searchParams.set('error','Enter at least one loss or claim amount');return NextResponse.redirect(back,303)}
 const endpoint=`/individuals/losses/${encodeURIComponent(taxpayer.nino)}/businesses/${encodeURIComponent(businessId)}/loss-claims/${encodeURIComponent(taxYear)}`
 try{const res=await fetch(`${hmrcApiBase}${endpoint}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.hmrc.7.0+json','Content-Type':'application/json',...(process.env.HMRC_ENVIRONMENT==='production'?{}:{'Gov-Test-Scenario':'STATEFUL','Gov-Test-Suspend-Temporal-Validations':'true'}),...fraud.headers},body:JSON.stringify(payload),cache:'no-store'});const text=await res.text();let data:any={};try{data=text?JSON.parse(text):{}}catch{data={raw:text}}const correlationId=res.headers.get('x-correlationid')||res.headers.get('x-correlation-id')||'';if(!res.ok){back.searchParams.set('error',data?.message||data?.code||`HMRC ${res.status}`);if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)}await reviewed(taxpayerId,taxYear);back.searchParams.set('lossSaved','1');back.searchParams.set('businessId',businessId);if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)}catch(e:any){back.searchParams.set('error',e.message||'Could not create or amend HMRC loss claim');return NextResponse.redirect(back,303)}
}
