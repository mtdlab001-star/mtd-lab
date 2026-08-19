import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic='force-dynamic'

function Row({label,ok,detail}:{label:string,ok:boolean,detail:string}){
  return <tr><td>{label}</td><td><span className={`statusPill ${ok?'statusDone':'statusOpen'}`}>{ok?'Ready':'Action needed'}</span></td><td>{detail}</td></tr>
}

export default async function ReadinessPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params
  const db=supabaseAdmin()
  let taxpayer:any=null,connection:any=null,eligible=0,auditReady=false
  try{
    const [{data:t},{data:c},{data:o}]=await Promise.all([
      db.from('taxpayers').select('nino,mtditid').eq('id',id).maybeSingle(),
      db.from('hmrc_connections').select('access_token,refresh_token,token_expires_at,scope').eq('taxpayer_id',id).maybeSingle(),
      db.from('hmrc_obligations').select('period_start,status').eq('taxpayer_id',id)
    ])
    taxpayer=t;connection=c
    eligible=(o||[]).filter((x:any)=>String(x.status).toLowerCase()==='open'&&x.period_start>='2025-04-06').length
  }catch{}
  try{
    const {error}=await db.from('hmrc_quarterly_submissions').select('id').limit(1)
    auditReady=!error
  }catch{}
  const sandbox=process.env.HMRC_ENVIRONMENT!=='production'
  const productionUnlocked=process.env.HMRC_ALLOW_PRODUCTION_SUBMISSIONS==='true'
  const vendorIp=!!process.env.HMRC_VENDOR_PUBLIC_IP
  const vendorLicense=!!process.env.HMRC_VENDOR_LICENSE_ID_HASH
  const appVersion=!!process.env.NEXT_PUBLIC_APP_VERSION
  const oauthScope=String(connection?.scope||'')
  const writeScope=oauthScope.includes('write:self-assessment')

  return <div className="shell"><aside className="side"><div className="brand">MTD Lab</div><div className="nav"><Link href="/">Dashboard</Link><Link href={`/taxpayers/${id}`}>Taxpayer workspace</Link><Link href={`/taxpayers/${id}/quarterly`}>Quarterly Updates</Link><Link href={`/taxpayers/${id}/quarterly/history`}>Submission history</Link><span>Readiness</span></div><div className="operator">Operated by Glomaxel IT Service</div></aside><main className="main"><div className="top"><div><h1 className="pageTitle">HMRC submission readiness</h1><p className="muted">Preflight checks for cumulative self employment quarterly updates.</p></div><span className="badge">{sandbox?'Sandbox':'Production'}</span></div><section className="panel" style={{marginTop:20}}><div className="tableWrap"><table><thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead><tbody><Row label="Taxpayer identifiers" ok={!!taxpayer?.nino&&!!taxpayer?.mtditid} detail={taxpayer?.nino&&taxpayer?.mtditid?'NINO and MTD Income Tax ID are stored.':'Synchronise the taxpayer and save both identifiers.'}/><Row label="HMRC OAuth connection" ok={!!connection?.access_token&&!!connection?.refresh_token} detail={connection?.access_token&&connection?.refresh_token?'Access and refresh tokens are available.':'Reconnect this taxpayer to HMRC.'}/><Row label="OAuth write scope" ok={writeScope} detail={writeScope?'write:self-assessment is authorised.':'Reconnect HMRC with write:self-assessment scope before submission.'}/><Row label="Eligible obligation" ok={eligible>0} detail={eligible>0?`${eligible} open cumulative obligation${eligible===1?'':'s'} from 2025/26 onward.`:'No open obligation starting on or after 6 April 2025 is currently stored.'}/><Row label="Submission audit table" ok={auditReady} detail={auditReady?'Quarterly submissions can be recorded before transmission.':'Supabase migration 002_hmrc_quarterly_submissions.sql still needs to be applied.'}/><Row label="Vendor public IP" ok={vendorIp} detail={vendorIp?'HMRC_VENDOR_PUBLIC_IP is configured.':'HMRC_VENDOR_PUBLIC_IP is required for the web application fraud headers.'}/><Row label="Vendor licence identifier" ok={vendorLicense} detail={vendorLicense?'Vendor licence hash is configured.':'HMRC_VENDOR_LICENSE_ID_HASH is not configured. If no licence value can be collected, HMRC guidance requires discussing the missing header with HMRC before omission.'}/><Row label="Application version" ok={appVersion} detail={appVersion?'NEXT_PUBLIC_APP_VERSION is configured.':'Set NEXT_PUBLIC_APP_VERSION so Gov-Vendor-Version is explicit.'}/><Row label="Production safeguard" ok={sandbox||!productionUnlocked} detail={sandbox?'Sandbox mode is active.':productionUnlocked?'Production submissions are explicitly enabled.':'Production is selected but live submissions remain locked.'}/></tbody></table></div></section><div className="status">Browser and request specific fraud values, including public client IP, public port, device ID, screen data, timezone, window size, MFA data and forwarding information, are checked again at submission time.</div></main></div>
}
