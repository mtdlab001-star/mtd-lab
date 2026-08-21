import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hmrcApiBase } from '@/lib/hmrc'
import { getValidHmrcAccessToken } from '@/lib/hmrc-connection'
import { buildFraudHeaders } from '@/lib/hmrc-fraud'
import { isSameOriginRequest } from '@/lib/request-security'

export async function POST(req:Request){
 if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
 const form=await req.formData();const taxpayerId=String(form.get('taxpayerId')||'demo');const taxYear=String(form.get('taxYear')||'');const confirm=String(form.get('confirmDelete')||'')
 const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/end-of-year/other-income`,req.url);back.searchParams.set('taxYear',taxYear)
 if(confirm!=='yes'){back.searchParams.set('error','Confirm that you want to delete the HMRC Other Income record before continuing.');return NextResponse.redirect(back,303)}
 if(!/^20\d{2}-\d{2}$/.test(taxYear)){back.searchParams.set('error','Select a valid HMRC tax year');return NextResponse.redirect(back,303)}
 const {data:taxpayer}=await supabaseAdmin().from('taxpayers').select('nino').eq('id',taxpayerId).maybeSingle();if(!taxpayer?.nino){back.searchParams.set('error','Taxpayer NINO is missing');return NextResponse.redirect(back,303)}
 let token:string;try{token=await getValidHmrcAccessToken(taxpayerId)}catch(e:any){back.searchParams.set('error',e.message||'HMRC connection is incomplete');return NextResponse.redirect(back,303)}
 const fraud=buildFraudHeaders(req,form,taxpayerId);if(fraud.missing.length){back.searchParams.set('error',`Missing HMRC fraud prevention data: ${fraud.missing.join(', ')}`);return NextResponse.redirect(back,303)}
 try{const res=await fetch(`${hmrcApiBase}/individuals/other-income/${encodeURIComponent(taxpayer.nino)}/${encodeURIComponent(taxYear)}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.hmrc.3.0+json',...(process.env.HMRC_ENVIRONMENT==='production'?{}:{'Gov-Test-Scenario':'DEFAULT'}),...fraud.headers},cache:'no-store'});const text=await res.text();let data:any={};try{data=text?JSON.parse(text):{}}catch{data={raw:text}}const correlationId=res.headers.get('x-correlationid')||res.headers.get('x-correlation-id')||'';if(!res.ok){back.searchParams.set('error',data?.message||data?.code||`HMRC ${res.status}`);if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)}back.searchParams.set('deleted','1');if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)}catch(e:any){back.searchParams.set('error',e.message||'Could not delete HMRC Other Income');return NextResponse.redirect(back,303)}
}
