import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { assessHmrcConnection } from '@/lib/hmrc-connection-status'
import TaxpayerSidebar from '@/app/components/TaxpayerSidebar'
import { incomeSourceTypeFromBusinessId, type MtdIncomeSourceType } from '@/lib/mtd-income-source'
import { quarterlyPeriodIsAvailable } from '@/lib/quarterly-submission-eligibility'
import { currentWorkspace } from '@/lib/workspace'

export const dynamic='force-dynamic'

function Row({label,ok,detail}:{label:string,ok:boolean,detail:string}){
  return <tr><td>{label}</td><td><span className={`statusPill ${ok?'statusDone':'statusOpen'}`}>{ok?'Ready':'Action needed'}</span></td><td>{detail}</td></tr>
}

function sourceLabel(type:MtdIncomeSourceType){if(type==='foreign-property')return 'Foreign Property';if(type==='uk-property')return 'UK Property';return 'Self Assessment'}
function fmtDate(value:string){
  if(!value)return 'the period end date'
  const d=new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime())?value:d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})
}

export default async function ReadinessPage({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<Record<string,string|undefined>>}){
  const {id}=await params
  const query=await searchParams
  const businessId=String(query.businessId||'').trim()
  const periodStart=String(query.periodStart||'').trim()
  const periodEnd=String(query.periodEnd||'').trim()
  const reviewToken=String(query.data||'')
  const requestedType=String(query.sourceType||'')
  const sourceType:MtdIncomeSourceType=['self-employment','uk-property','foreign-property'].includes(requestedType)?requestedType as MtdIncomeSourceType:incomeSourceTypeFromBusinessId(businessId)
  const db=supabaseAdmin()
  const workspace=await currentWorkspace()
  const firmId=workspace?.firmId||''
  let taxpayer:any=null,connection:any=null,eligible:any[]=[],auditReady=false
  try{
    if(!firmId)throw new Error('Workspace unavailable')
    const [{data:t},{data:c},{data:o}]=await Promise.all([
      db.from('taxpayers').select('nino,mtditid').eq('id',id).eq('firm_id',firmId).maybeSingle(),
      db.from('hmrc_connections').select('access_token,refresh_token,token_expires_at,scope').eq('taxpayer_id',id).eq('firm_id',firmId).maybeSingle(),
      db.from('hmrc_obligations').select('business_id,period_start,period_end,due_date,status').eq('taxpayer_id',id).eq('firm_id',firmId)
    ])
    taxpayer=t;connection=c
    eligible=(o||[]).filter((x:any)=>String(x.status).toLowerCase()==='open'&&x.period_start>='2025-04-06'&&(!businessId||String(x.business_id||'')===businessId)&&(!periodStart||String(x.period_start||'')===periodStart)&&(!periodEnd||String(x.period_end||'')===periodEnd))
  }catch{}
  try{
    if(!firmId)throw new Error('Workspace unavailable')
    const {error}=await db.from('hmrc_quarterly_submissions').select('id').eq('firm_id',firmId).limit(1)
    auditReady=!error
  }catch{}
  const sandbox=process.env.HMRC_ENVIRONMENT!=='production'
  const productionUnlocked=process.env.HMRC_ALLOW_PRODUCTION_SUBMISSIONS==='true'
  const vendorIp=sandbox||!!process.env.HMRC_VENDOR_PUBLIC_IP
  const vendorLicense=sandbox||!!process.env.HMRC_VENDOR_LICENSE_ID_HASH
  const appVersion=process.env.NEXT_PUBLIC_APP_VERSION||'0.3.0'
  const oauthScope=String(connection?.scope||'')
  const connectionStatus=assessHmrcConnection(connection)
  const writeScope=oauthScope.includes('write:self-assessment')
  const focused=Boolean(businessId||periodStart||periodEnd)
  const periodAvailable=!focused||!periodEnd||quarterlyPeriodIsAvailable(periodEnd)
  const selectedReady=eligible.length>0&&periodAvailable
  const eligibleDetail=eligible.length
    ? focused
      ? periodAvailable
        ? 'The selected HMRC obligation is open and eligible for submission.'
        : `The selected HMRC obligation is open for preparation and review, but HMRC submission remains locked until the quarter ends on ${fmtDate(periodEnd)}.`
      : `${eligible.length} open cumulative obligation${eligible.length===1?'':'s'} from 2025/26 onward.`
    : focused
      ? 'The selected income source and period do not have a matching open HMRC obligation. Refresh HMRC data before submission.'
      : 'No open obligation starting on or after 6 April 2025 is currently stored.'
  const reviewHref=reviewToken?`/taxpayers/${encodeURIComponent(id)}/quarterly/review?data=${encodeURIComponent(reviewToken)}`:`/taxpayers/${encodeURIComponent(id)}/submissions?type=${encodeURIComponent(sourceType)}&businessId=${encodeURIComponent(businessId)}&periodStart=${encodeURIComponent(periodStart)}&periodEnd=${encodeURIComponent(periodEnd)}`

  return <div className="shell"><TaxpayerSidebar taxpayerId={id} active="submissions"/><main className="main"><div className="top"><div><h1 className="pageTitle">HMRC submission readiness</h1><p className="muted">Preflight checks for cumulative {sourceLabel(sourceType)} quarterly updates.</p></div><div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><span className="badge">{sandbox?'Sandbox':'Production'}</span>{focused&&<Link className="btn btnSmall" href={reviewHref}>{reviewToken?'Back to review':'Back to update'}</Link>}</div></div>{focused&&<section className="panel" style={{marginTop:20}}><span className="eyebrow">Income source</span><h2 style={{margin:'4px 0'}}>{sourceLabel(sourceType)}</h2>{businessId&&<div className="mono muted">{businessId}</div>}{periodStart&&periodEnd&&<p className="muted" style={{marginBottom:0}}>Selected period: {periodStart} to {periodEnd}</p>}</section>}<section className="panel" style={{marginTop:20}}><div className="tableWrap"><table><thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead><tbody><Row label="Taxpayer identifiers" ok={!!taxpayer?.nino&&!!taxpayer?.mtditid} detail={taxpayer?.nino&&taxpayer?.mtditid?'NINO and MTD Income Tax ID are stored.':'Synchronise the taxpayer and save both identifiers.'}/><Row label="HMRC OAuth connection" ok={connectionStatus.usable} detail={connectionStatus.detail}/><Row label="OAuth write scope" ok={connectionStatus.usable&&writeScope} detail={!connectionStatus.usable?'Reconnect this taxpayer to HMRC before checking scopes.':writeScope?'write:self-assessment is authorised.':'Reconnect HMRC with write:self-assessment scope before submission.'}/><Row label={focused?'Submission eligibility':'Eligible obligation'} ok={focused?selectedReady:eligible.length>0} detail={eligibleDetail}/><Row label="Submission audit table" ok={auditReady} detail={auditReady?'Quarterly submissions can be recorded before transmission.':'Supabase migration 002_hmrc_quarterly_submissions.sql still needs to be applied.'}/><Row label="Vendor public IP" ok={vendorIp} detail={vendorIp?'HMRC_VENDOR_PUBLIC_IP is configured.':'HMRC_VENDOR_PUBLIC_IP is required for the web application fraud headers.'}/><Row label="Vendor licence identifier" ok={vendorLicense} detail={vendorLicense?'Vendor licence hash is configured.':'HMRC_VENDOR_LICENSE_ID_HASH is not configured. If no licence value can be collected, HMRC guidance requires discussing the missing header with HMRC before omission.'}/><Row label="Application version" ok={!!appVersion} detail={`Gov-Vendor-Version will report MTD Lab ${appVersion}.`}/><Row label="Production safeguard" ok={sandbox||!productionUnlocked} detail={sandbox?'Sandbox mode is active.':productionUnlocked?'Production submissions are explicitly enabled.':'Production is selected but live submissions remain locked.'}/></tbody></table></div></section><div className="status">Browser and request specific fraud values, including public client IP, public port, device ID, screen data, timezone, window size, MFA data and forwarding information, are checked again at submission time.</div></main></div>
}
