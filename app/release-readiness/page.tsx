import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { HMRC_API_VERSIONS } from '@/lib/hmrc-api-versions'
import { expireAgentAuthorisations } from '@/lib/agent-authorisation'
import { assessHmrcConnection } from '@/lib/hmrc-connection-status'

export const dynamic='force-dynamic'

export default async function ReleaseReadinessPage(){
  const db=supabaseAdmin();try{await expireAgentAuthorisations()}catch{}
  const [connections,syncs,quarterly,directQuarterly,agentQuarterly,calculations,finals,directFinals,agentFinals,loginAttempts]=await Promise.all([
    db.from('hmrc_connections').select('access_token,refresh_token,token_expires_at,scope'),
    db.from('hmrc_sync_runs').select('id',{count:'exact',head:true}).eq('status','complete'),
    db.from('hmrc_quarterly_submissions').select('id',{count:'exact',head:true}).eq('status','submitted'),
    db.from('hmrc_quarterly_submissions').select('id',{count:'exact',head:true}).eq('status','submitted').is('acting_agent_id',null),
    db.from('hmrc_quarterly_submissions').select('id',{count:'exact',head:true}).eq('status','submitted').not('acting_agent_id','is',null),
    db.from('mtd_submission_audit').select('id',{count:'exact',head:true}).eq('event_type','tax_calculation_retrieval').eq('status','accepted'),
    db.from('mtd_submission_audit').select('id',{count:'exact',head:true}).eq('event_type','final_declaration').eq('status','accepted'),
    db.from('mtd_submission_audit').select('id',{count:'exact',head:true}).eq('event_type','final_declaration').eq('status','accepted').is('acting_agent_id',null),
    db.from('mtd_submission_audit').select('id',{count:'exact',head:true}).eq('event_type','final_declaration').eq('status','accepted').not('acting_agent_id','is',null),
    db.from('app_login_attempts').select('id',{count:'exact',head:true}),
  ])
  const connectionStatuses=(connections.data||[]).map(c=>assessHmrcConnection(c))
  const usableConnections=connectionStatuses.filter(c=>c.usable).length
  const reconnectRequired=connectionStatuses.filter(c=>c.connected&&!c.usable).length
  const env=process.env.HMRC_ENVIRONMENT||'sandbox';const productionEnabled=process.env.HMRC_ALLOW_PRODUCTION_SUBMISSIONS==='true'
  const configReady=Boolean(process.env.HMRC_CLIENT_ID&&process.env.HMRC_CLIENT_SECRET&&process.env.HMRC_REDIRECT_URI&&process.env.HMRC_STATE_SECRET&&process.env.SUPABASE_SERVICE_ROLE_KEY)
  const evidenceChecks=[
    {name:'Core HMRC and Supabase secrets configured',ok:configReady,detail:configReady?'Required server configuration is present.':'One or more required server environment variables are missing.'},
    {name:'Usable HMRC connection evidence',ok:usableConnections>0,detail:`${usableConnections} usable HMRC connection(s). ${reconnectRequired} require reconnect.`},
    {name:'Successful HMRC synchronisation',ok:(syncs.count||0)>0,detail:`${syncs.count||0} successful synchronisation run(s).`},
    {name:'Accepted quarterly update evidence',ok:(quarterly.count||0)>0,detail:`${quarterly.count||0} accepted quarterly update(s). Direct ${directQuarterly.count||0}, agent ${agentQuarterly.count||0}.`},
    {name:'Direct quarterly filing tested',ok:(directQuarterly.count||0)>0,detail:`${directQuarterly.count||0} accepted direct quarterly update(s).`},
    {name:'Agent delegated quarterly filing tested',ok:(agentQuarterly.count||0)>0,detail:`${agentQuarterly.count||0} accepted delegated quarterly update(s).`},
    {name:'HMRC calculation retrieval evidence',ok:(calculations.count||0)>0,detail:`${calculations.count||0} accepted calculation retrieval(s).`},
    {name:'Final Declaration evidence',ok:(finals.count||0)>0,detail:`${finals.count||0} accepted Final Declaration(s). Direct ${directFinals.count||0}, agent ${agentFinals.count||0}.`},
    {name:'Login abuse audit storage',ok:!loginAttempts.error,detail:loginAttempts.error?'Login attempt audit table is unavailable.':'Login attempt audit and rate limit storage is available.'},
    {name:'Central HMRC API version registry',ok:Boolean(HMRC_API_VERSIONS),detail:'HMRC API media type versions are centrally controlled.'},
  ]
  const safetyLock={name:'Production submission safety lock',ok:env!=='production'||!productionEnabled,detail:env==='production'?(productionEnabled?'Production submissions are enabled. Confirm explicit release approval and monitoring.':'Production environment detected, submission lock remains active.'):'Sandbox environment active. Production submissions remain isolated.'}
  const preReleaseReady=evidenceChecks.every(c=>c.ok)&&safetyLock.ok
  const productionLive=preReleaseReady&&env==='production'&&productionEnabled
  const checks=[...evidenceChecks,safetyLock];const passed=checks.filter(c=>c.ok).length
  const stateLabel=productionLive?'Production enabled':preReleaseReady?'Pre release ready':'Validation incomplete'
  return <div className="shell"><aside className="side"><div className="brand">MTD Lab</div><div className="nav"><Link href="/">Dashboard</Link><Link href="/taxpayers">Taxpayers</Link><Link href="/agents">Agents</Link><Link href="/taxpayers/sandbox">Sandbox setup</Link><span>Release readiness</span></div><div className="operator">Operated by Glomaxel IT Service</div></aside><main className="main"><div className="top"><div><h1 className="pageTitle">Stage 2 release readiness</h1><p className="muted">Controlled evidence gate before any production MTD Income Tax submission capability is enabled.</p></div><span className={`statusPill ${preReleaseReady?'statusDone':'statusOpen'}`}>{stateLabel}</span></div><div className="cards" style={{marginTop:20}}><div className="card"><span className="eyebrow">Checks passed</span><strong>{passed} of {checks.length}</strong></div><div className="card"><span className="eyebrow">HMRC environment</span><strong>{env}</strong></div><div className="card"><span className="eyebrow">Production submissions</span><strong>{productionEnabled?'Enabled':'Locked'}</strong></div><div className="card"><span className="eyebrow">API families controlled</span><strong>{Object.keys(HMRC_API_VERSIONS).length}</strong></div></div><section className="panel" style={{marginTop:16}}><h2>Release gate</h2><div className="tableWrap"><table><thead><tr><th>Control</th><th>Status</th><th>Evidence</th></tr></thead><tbody>{checks.map(c=><tr key={c.name}><td><strong>{c.name}</strong></td><td><span className={`statusPill ${c.ok?'statusDone':'statusOpen'}`}>{c.ok?'Pass':'Pending'}</span></td><td>{c.detail}</td></tr>)}</tbody></table></div></section><div className="status" style={{marginTop:16}}><strong>Safety rule:</strong> Pre release readiness must be achieved while production submissions remain locked. Production activation is a separate explicit release action after final approval.</div><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:16}}><Link className="btn" href="/taxpayers/sandbox">Open sandbox validation</Link><Link className="btn btnSmall" href="/agents">Review agents</Link><a className="btn btnSmall" href="/api/hmrc/version-health" target="_blank" rel="noreferrer">API version health</a></div></main></div>
}
