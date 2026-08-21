import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hmrcApiBase } from '@/lib/hmrc'
import { getValidHmrcAccessToken } from '@/lib/hmrc-connection'
import { buildFraudHeaders } from '@/lib/hmrc-fraud'
import { markYearEndReviewed } from '@/lib/year-end-review'
import { isSameOriginRequest } from '@/lib/request-security'

function n(f:FormData,k:string){const r=String(f.get(k)||'').trim();if(!r)return undefined;const v=Number(r);return Number.isFinite(v)&&v>=0?v:undefined}
function t(f:FormData,k:string){const v=String(f.get(k)||'').trim();return v||undefined}
function item(f:FormData,p:string,nameKey='name'):any{const ref=t(f,`${p}Ref`),name=t(f,`${p}${nameKey==='companyName'?'CompanyName':'Name'}`),date=t(f,`${p}Date`),amount=n(f,`${p}Amount`),relief=n(f,`${p}Relief`);if(!ref&&!name&&!date&&amount===undefined&&relief===undefined)return undefined;if(!ref||!name||!date||amount===undefined||relief===undefined)throw new Error(`${p.toUpperCase()} requires reference, name, investment date, amount invested and relief claimed.`);return {uniqueInvestmentRef:ref,[nameKey]:name,dateOfInvestment:date,amountInvested:amount,reliefClaimed:relief}}

export async function POST(req:Request){
 if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
 const f=await req.formData();const taxpayerId=String(f.get('taxpayerId')||'demo'),taxYear=String(f.get('taxYear')||'');const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/end-of-year/reliefs`,req.url);back.searchParams.set('taxYear',taxYear);back.searchParams.set('type','investment')
 try{if(!/^20\d{2}-\d{2}$/.test(taxYear))throw new Error('Select a valid HMRC tax year');const vct:any=item(f,'vct');const eis:any=item(f,'eis');const community:any=item(f,'community');const seed:any=item(f,'seed','companyName');if(eis)eis.knowledgeIntensive=String(f.get('eisKnowledgeIntensive')||'false')==='true';const payload:any={};if(vct)payload.vctSubscription=[vct];if(eis)payload.eisSubscription=[eis];if(community)payload.communityInvestment=[community];if(seed)payload.seedEnterpriseInvestment=[seed];if(!Object.keys(payload).length)throw new Error('Enter at least one investment relief claim')
 const {data:taxpayer}=await supabaseAdmin().from('taxpayers').select('nino').eq('id',taxpayerId).maybeSingle();if(!taxpayer?.nino)throw new Error('Taxpayer NINO is missing');const token=await getValidHmrcAccessToken(taxpayerId);const fraud=buildFraudHeaders(req,f,taxpayerId);if(fraud.missing.length)throw new Error(`Missing HMRC fraud prevention data: ${fraud.missing.join(', ')}`)
 const res=await fetch(`${hmrcApiBase}/individuals/reliefs/investment/${encodeURIComponent(taxpayer.nino)}/${encodeURIComponent(taxYear)}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.hmrc.3.0+json','Content-Type':'application/json',...(process.env.HMRC_ENVIRONMENT==='production'?{}:{'Gov-Test-Scenario':'DEFAULT'}),...fraud.headers},body:JSON.stringify(payload),cache:'no-store'});const raw=await res.text();let data:any={};try{data=raw?JSON.parse(raw):{}}catch{data={raw}}const correlationId=res.headers.get('x-correlationid')||res.headers.get('x-correlation-id')||'';if(!res.ok){back.searchParams.set('error',data?.message||data?.code||`HMRC ${res.status}`);if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)}await markYearEndReviewed(taxpayerId,taxYear,'reliefs','Investment reliefs updated in HMRC');back.searchParams.set('savedInvestment','1');if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)
 }catch(e:any){back.searchParams.set('error',e.message||'Could not submit investment reliefs');return NextResponse.redirect(back,303)}
}
