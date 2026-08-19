import { NextResponse } from 'next/server'
import { hmrcGet } from '@/lib/hmrc'
import { getValidHmrcAccessToken } from '@/lib/hmrc-connection'
import { supabaseAdmin } from '@/lib/supabase-admin'

function firstValue(obj:any,keys:string[]){for(const key of keys){const value=obj?.[key];if(value!==undefined&&value!==null&&value!=='')return value}return null}
function throwIfError(error:any,context:string){if(error)throw new Error(`${context}: ${error.message||JSON.stringify(error)}`)}

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

export async function POST(req:Request){
  const form=await req.formData()
  const taxpayerId=String(form.get('taxpayerId')||'demo')
  const nino=String(form.get('nino')||'').trim().toUpperCase()
  const mtditid=String(form.get('mtditid')||'').trim().toUpperCase()
  const db=supabaseAdmin()
  try{
    const accessToken=await getValidHmrcAccessToken(taxpayerId)
    const {error:taxpayerError}=await db.from('taxpayers').upsert({id:taxpayerId,display_name:taxpayerId==='demo'?'HMRC Sandbox Taxpayer':taxpayerId,nino,mtditid,updated_at:new Date().toISOString()})
    throwIfError(taxpayerError,'Taxpayer update failed')

    const businesses=await hmrcGet(`/individuals/business/details/${encodeURIComponent(nino)}/list`,accessToken,'application/vnd.hmrc.2.0+json')
    const list=Array.isArray(businesses?.listOfBusinesses)?businesses.listOfBusinesses:[]
    const {error:deleteBusinessesError}=await db.from('hmrc_businesses').delete().eq('taxpayer_id',taxpayerId)
    throwIfError(deleteBusinessesError,'Deleting existing businesses failed')
    if(list.length){const {error}=await db.from('hmrc_businesses').insert(list.map((b:any)=>({taxpayer_id:taxpayerId,business_id:b.incomeSourceId||b.businessId,business_type:b.incomeSourceType||b.type,business_name:b.businessName||b.tradingName||b.incomeSourceName||null,raw:b})));throwIfError(error,'Saving businesses failed')}

    const {fromDate,toDate}=currentUkTaxYearRange()
    const currentPath=`/obligations/details/${encodeURIComponent(nino)}/income-and-expenditure?fromDate=${fromDate}&toDate=${toDate}`
    let obligations:any=null
    let all:any[]=[]

    if(process.env.HMRC_ENVIRONMENT!=='production'){
      try{
        obligations=await hmrcGet(currentPath,accessToken,'application/vnd.hmrc.3.0+json','DYNAMIC')
        all=flattenObligations(obligations)
      }catch{}
    }

    if(!hasModernObligation(all)){
      try{
        obligations=await hmrcGet(currentPath,accessToken,'application/vnd.hmrc.3.0+json','DEFAULT')
        all=flattenObligations(obligations)
      }catch{}
    }

    if(!hasModernObligation(all)&&process.env.HMRC_ENVIRONMENT!=='production'){
      obligations=await hmrcGet(`/obligations/details/${encodeURIComponent(nino)}/income-and-expenditure`,accessToken,'application/vnd.hmrc.3.0+json','DEFAULT')
      all=flattenObligations(obligations)
    }

    const {error:deleteObligationsError}=await db.from('hmrc_obligations').delete().eq('taxpayer_id',taxpayerId)
    throwIfError(deleteObligationsError,'Deleting existing obligations failed')
    if(all.length){const rows=all.map((o:any)=>({taxpayer_id:taxpayerId,business_id:o.businessId,period_start:firstValue(o,['periodStartDate','inboundCorrespondenceFrom','start','PeriodStartDate']),period_end:firstValue(o,['periodEndDate','inboundCorrespondenceTo','end','PeriodEndDate']),due_date:firstValue(o,['dueDate','inboundCorrespondenceDueDate','due','DueDate']),status:firstValue(o,['status','Status']),received_date:firstValue(o,['receivedDate','inboundCorrespondenceDateReceived','inboundCorrespondenceReceivedDate','received','ReceivedDate']),raw:o}));const {error}=await db.from('hmrc_obligations').insert(rows);throwIfError(error,'Saving obligations failed')}

    const {error:syncLogError}=await db.from('hmrc_sync_runs').insert({taxpayer_id:taxpayerId,status:'complete',businesses_count:list.length,obligations_count:all.length,completed_at:new Date().toISOString()})
    throwIfError(syncLogError,'Saving sync log failed')
    return NextResponse.redirect(new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}?synced=1`,req.url),303)
  }catch(e:any){
    await db.from('hmrc_sync_runs').insert({taxpayer_id:taxpayerId,status:'failed',error_message:e.message||'Sync failed',completed_at:new Date().toISOString()})
    return NextResponse.redirect(new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}?error=${encodeURIComponent(e.message||'Sync failed')}`,req.url),303)
  }
}
