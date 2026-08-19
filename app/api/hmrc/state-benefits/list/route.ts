import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hmrcApiBase } from '@/lib/hmrc'
import { getValidHmrcAccessToken } from '@/lib/hmrc-connection'

export async function GET(req:Request){
 const url=new URL(req.url);const taxpayerId=String(url.searchParams.get('taxpayerId')||'demo');const taxYear=String(url.searchParams.get('taxYear')||'')
 const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/end-of-year/state-benefits`,req.url);back.searchParams.set('taxYear',taxYear)
 if(!/^20\d{2}-\d{2}$/.test(taxYear)){back.searchParams.set('error','Select a valid HMRC tax year');return NextResponse.redirect(back,303)}
 const {data:taxpayer}=await supabaseAdmin().from('taxpayers').select('nino').eq('id',taxpayerId).maybeSingle();if(!taxpayer?.nino){back.searchParams.set('error','Taxpayer NINO is missing');return NextResponse.redirect(back,303)}
 let token:string;try{token=await getValidHmrcAccessToken(taxpayerId)}catch(e:any){back.searchParams.set('error',e.message||'HMRC connection is incomplete');return NextResponse.redirect(back,303)}
 const endpoint=`/individuals/state-benefits/${encodeURIComponent(taxpayer.nino)}/${encodeURIComponent(taxYear)}`
 try{
  const res=await fetch(`${hmrcApiBase}${endpoint}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.hmrc.2.0+json',...(process.env.HMRC_ENVIRONMENT==='production'?{}:{'Gov-Test-Scenario':'DEFAULT'})},cache:'no-store'})
  const text=await res.text();let payload:any={};try{payload=text?JSON.parse(text):{}}catch{payload={raw:text}}
  const correlationId=res.headers.get('x-correlationid')||res.headers.get('x-correlation-id')||''
  if(!res.ok){back.searchParams.set('error',res.status===404?'No HMRC state benefits were found for this tax year.':(payload?.message||payload?.code||`HMRC ${res.status}`));if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)}
  back.searchParams.set('retrieved','1');back.searchParams.set('result',Buffer.from(JSON.stringify(payload)).toString('base64url'));if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)
 }catch(e:any){back.searchParams.set('error',e.message||'Could not retrieve HMRC state benefits');return NextResponse.redirect(back,303)}
}
