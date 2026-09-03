import { NextResponse } from 'next/server'
import { hmrcGet } from '@/lib/hmrc'
import { getHmrcAccessTokenForActingCapacity } from '@/lib/hmrc-connection'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hmrcAcceptHeader } from '@/lib/hmrc-api-versions'
import { buildFraudHeaders } from '@/lib/hmrc-fraud'
import { isSameOriginRequest } from '@/lib/request-security'
import { resolveConnectedAgentForPermission } from '@/lib/agent-authorisation'
import { hmrcBusinessType, mergeBusinessPayloads } from '@/lib/hmrc-businesses'
import { reconcileSandboxObligationBusinessIds } from '@/lib/hmrc-obligations'
import { currentWorkspace } from '@/lib/workspace'

function firstValue(obj:any,keys:string[]){for(const key of keys){const value=obj?.[key];if(value!==undefined&&value!==null&&value!=='')return value}return null}
function throwIfError(error:any,context:string){if(error)throw new Error(`${context}: ${error.message||JSON.stringify(error)}`)}
function validNino(value:string){return /^[A-Z]{2}\d{6}[A-D]$/.test(value)}

function currentUkTaxYearRange(){
  const now=new Date()
  const year=now.getUTCFullYear()
  const month=now.getUTCMonth()+1
  const day=now.getUTCDate()
  const startYear=month>4||(month===4&&day>=6)?year:year-1
  return {fromDate:`${startYear}-04-06`,toDate:`${startYear+1}-04-05`}
}

function flattenObligations(payload:any){
  const groups=Array.isArray(payload?.obligations)?payload.obligations:[]
  return groups.flatMap((group:any)=>(group.obligationDetails||[]).map((o:any)=>({...o,businessId:group.identification||group.businessId||group.incomeSourceId||null})))
}

function hasModernObligation(rows:any[]){
  return rows.some((o:any)=>String(firstValue(o,['periodStartDate','inboundCorrespondenceFrom','start','PeriodStartDate'])||'')>='2025-04-06')
}

function dedupeObligations(rows:any[]){
  const map=new Map<string,any>()
  for(const row of rows){
    const key=[row.businessId||'',firstValue(row,['periodStartDate','inboundCorrespondenceFrom','start','PeriodStartDate'])||'',firstValue(row,['periodEndDate','inboundCorrespondenceTo','end','PeriodEndDate'])||'',firstValue(row,['dueDate','inboundCorrespondenceDueDate','due','DueDate'])||'',String(firstValue(row,['status','Status'])||'').toLowerCase()].join('|')
    if(!map.has(key))map.set(key,row)
  }
  return Array.from(map.values())
}

export async function POST(req:Request){
 if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
  const workspace=await currentWorkspace()
  if(!workspace)return new NextResponse('Accounting workspace access is not available',{status:403})
  const form=await req.formData()
  const taxpayerId=String(form.get('taxpayerId')||'demo')
  const nino=String(form.get('nino')||'').trim().toUpperCase()
  const mtditid=String(form.get('mtditid')||'').trim().toUpperCase()
  const requestedAgentId=String(form.get('actingAgentId')||'').trim()||null
  const db=supabaseAdmin()
  const {data:ownedTaxpayer}=await db.from('taxpayers').select('id').eq('id',taxpayerId).eq('firm_id',workspace.firmId).maybeSingle()
  if(!ownedTaxpayer)return NextResponse.redirect(new URL('/taxpayers?error=Taxpayer%20workspace%20not%20found',req.url),303)
  try{
    if(!validNino(nino))throw new Error('Enter a valid NINO before syncing with HMRC.')
    const fraud=buildFraudHeaders(req,form,taxpayerId)
    if(fraud.missing.length)throw new Error(`Missing HMRC fraud prevention data: ${fraud.missing.join(', ')}`)
    const actingAgentId=requestedAgentId?await resolveConnectedAgentForPermission(taxpayerId,'can_view_obligations',requestedAgentId):null
    if(requestedAgentId&&!actingAgentId)throw new Error('The selected agent is not connected or authorised to view this taxpayer’s HMRC obligations.')
    const accessToken=await getHmrcAccessTokenForActingCapacity(taxpayerId,actingAgentId)
    const taxpayerUpdate:any={nino,updated_at:new Date().toISOString()};if(mtditid)taxpayerUpdate.mtditid=mtditid
    const {error:taxpayerError}=await db.from('taxpayers').update(taxpayerUpdate).eq('id',taxpayerId).eq('firm_id',workspace.firmId)
    throwIfError(taxpayerError,'Taxpayer update failed')

    const businessPath=`/individuals/business/details/${encodeURIComponent(nino)}/list`
    const businessAccept=hmrcAcceptHeader('businessDetails')
    const businessPayloads:any[]=[]
    if(process.env.HMRC_ENVIRONMENT!=='production'){try{businessPayloads.push(await hmrcGet(businessPath,accessToken,businessAccept,'STATEFUL',fraud.headers))}catch{}}
    businessPayloads.push(await hmrcGet(businessPath,accessToken,businessAccept,'DEFAULT',fraud.headers))
    const list=mergeBusinessPayloads(businessPayloads)
    const {error:deleteBusinessesError}=await db.from('hmrc_businesses').delete().eq('firm_id',workspace.firmId).eq('taxpayer_id',taxpayerId)
    throwIfError(deleteBusinessesError,'Deleting existing businesses failed')
    if(list.length){const {error}=await db.from('hmrc_businesses').insert(list.map((b:any)=>({firm_id:workspace.firmId,taxpayer_id:taxpayerId,business_id:b.incomeSourceId||b.businessId,business_type:hmrcBusinessType(b),business_name:b.businessName||b.tradingName||b.incomeSourceName||null,raw:b})));throwIfError(error,'Saving businesses failed')}

    const {fromDate,toDate}=currentUkTaxYearRange()
    const currentPath=`/obligations/details/${encodeURIComponent(nino)}/income-and-expenditure?fromDate=${fromDate}&toDate=${toDate}`
    let obligations:any=null
    let all:any[]=[]
    const obligationsAccept=hmrcAcceptHeader('obligations')
    if(process.env.HMRC_ENVIRONMENT!=='production'){try{obligations=await hmrcGet(currentPath,accessToken,obligationsAccept,'DYNAMIC',fraud.headers);all=flattenObligations(obligations)}catch{}}
    if(!hasModernObligation(all)){try{obligations=await hmrcGet(currentPath,accessToken,obligationsAccept,'DEFAULT',fraud.headers);all=flattenObligations(obligations)}catch{}}
    if(!hasModernObligation(all)&&process.env.HMRC_ENVIRONMENT!=='production'){obligations=await hmrcGet(`/obligations/details/${encodeURIComponent(nino)}/income-and-expenditure`,accessToken,obligationsAccept,'DEFAULT',fraud.headers);all=flattenObligations(obligations)}

    const reconciledObligations=reconcileSandboxObligationBusinessIds(all,list,process.env.HMRC_ENVIRONMENT)
    const uniqueObligations=dedupeObligations(reconciledObligations)
    const {error:deleteObligationsError}=await db.from('hmrc_obligations').delete().eq('firm_id',workspace.firmId).eq('taxpayer_id',taxpayerId)
    throwIfError(deleteObligationsError,'Deleting existing obligations failed')
    if(uniqueObligations.length){const rows=uniqueObligations.map((o:any)=>({firm_id:workspace.firmId,taxpayer_id:taxpayerId,business_id:o.businessId,period_start:firstValue(o,['periodStartDate','inboundCorrespondenceFrom','start','PeriodStartDate']),period_end:firstValue(o,['periodEndDate','inboundCorrespondenceTo','end','PeriodEndDate']),due_date:firstValue(o,['dueDate','inboundCorrespondenceDueDate','due','DueDate']),status:firstValue(o,['status','Status']),received_date:firstValue(o,['receivedDate','inboundCorrespondenceDateReceived','inboundCorrespondenceReceivedDate','received','ReceivedDate']),raw:o}));const {error}=await db.from('hmrc_obligations').insert(rows);throwIfError(error,'Saving obligations failed')}

    const {error:syncLogError}=await db.from('hmrc_sync_runs').insert({firm_id:workspace.firmId,taxpayer_id:taxpayerId,status:'complete',businesses_count:list.length,obligations_count:uniqueObligations.length,completed_at:new Date().toISOString()})
    throwIfError(syncLogError,'Saving sync log failed')
    const resultUrl=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}?synced=1`,req.url)
    if(actingAgentId)resultUrl.searchParams.set('actingAs','agent')
    return NextResponse.redirect(resultUrl,303)
  }catch(e:any){
    await db.from('hmrc_sync_runs').insert({firm_id:workspace.firmId,taxpayer_id:taxpayerId,status:'failed',error_message:e.message||'Sync failed',completed_at:new Date().toISOString()})
    return NextResponse.redirect(new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}?error=${encodeURIComponent(e.message||'Sync failed')}`,req.url),303)
  }
}