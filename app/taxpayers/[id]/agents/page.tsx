import { notFound } from 'next/navigation'
import TaxpayerSidebar from '@/app/components/TaxpayerSidebar'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { expireAgentAuthorisations } from '@/lib/agent-authorisation'
import { currentWorkspace } from '@/lib/workspace'

export const dynamic='force-dynamic'
function fmt(v?:string|null){if(!v)return 'Not set';const d=new Date(v);return Number.isNaN(d.getTime())?v:d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
function effectiveStatus(r:any){if(r.status==='authorised'&&r.expires_at&&new Date(r.expires_at).getTime()<=Date.now())return 'expired';if(r.status==='authorised'&&r.mtd_agents?.status&&r.mtd_agents.status!=='active')return 'agent inactive';return r.status}
function isActive(r:any){return effectiveStatus(r)==='authorised'}

export default async function AgentAuthorisationPage({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<Record<string,string|undefined>>}){
  const {id}=await params;const qs=await searchParams
  const workspace=await currentWorkspace()
  if(!workspace)notFound()
  let taxpayer:any=null
  let rows:any[]=[]
  let agentConnections:any[]=[]
  let unavailable=''
  try{
    const db=supabaseAdmin();try{await expireAgentAuthorisations(id)}catch{}
    const [{data:taxpayerRow},{data:links},{data:connections}]=await Promise.all([
      db.from('taxpayers').select('id,display_name,nino').eq('id',id).eq('firm_id',workspace.firmId).maybeSingle(),
      db.from('mtd_agent_authorisations').select('*,mtd_agents(*)').eq('firm_id',workspace.firmId).eq('taxpayer_id',id).order('created_at',{ascending:false}),
      db.from('agent_hmrc_connections').select('agent_id,connected_at,token_expires_at').eq('firm_id',workspace.firmId)
    ])
    if(!taxpayerRow)notFound()
    taxpayer=taxpayerRow
    rows=links||[]
    agentConnections=connections||[]
  }catch(error:any){
    if(error?.digest?.startsWith?.('NEXT_NOT_FOUND'))throw error
    unavailable=error?.message||'Database configuration is temporarily unavailable.'
  }
  const connectionByAgent=new Map((agentConnections||[]).map((c:any)=>[c.agent_id,c]))
  return <div className="shell"><TaxpayerSidebar taxpayerId={id} active="agents"/><main className="main">
    <div className="top"><div><h1 className="pageTitle">Agent Authorisation</h1><p className="muted">Control which tax agent may act for {taxpayer?.display_name||'this taxpayer'} inside MTD Lab.</p></div><span className="badge">Scoped access</span></div>
    {unavailable&&<div className="status statusError"><strong>Agent authorisation data is temporarily unavailable.</strong><div>{unavailable}</div></div>}
    {qs.error&&<div className="status statusError">{qs.error}</div>}{qs.saved&&<div className="status">Agent authorisation saved.</div>}{qs.revoked&&<div className="status">Agent authorisation revoked.</div>}{qs.agentConnected&&<div className="status"><strong>Agent ASA connection saved.</strong><div>The software connection is ready. HMRC client authority is checked separately below.</div></div>}
    {qs.hmrcRelationship==='active'&&<div className="status"><strong>HMRC client relationship active.</strong><div>HMRC confirms that the connected agent can act for this taxpayer for MTD Income Tax.</div></div>}
    {qs.hmrcRelationship==='inactive'&&<div className="status statusError"><strong>HMRC client relationship not active.</strong><div>Create an HMRC sandbox authorisation request below, or confirm the client has accepted the request.</div></div>}
    {qs.hmrcInvitationAccepted&&<div className="status"><strong>Sandbox authorisation accepted.</strong><div>The HMRC test support service accepted the invitation and the relationship check passed.</div></div>}

    <section className="panel" style={{marginTop:20}}><div className="sectionHead"><div><h2>Authorised agents</h2><p className="muted">MTD Lab permission, ASA software connection and HMRC client authority are separate controls. All three must be valid before delegated filing.</p></div><strong>{rows.filter(isActive).length} active</strong></div><div className="tableWrap"><table><thead><tr><th>Agent</th><th>HMRC ARN</th><th>MTD Lab</th><th>Expires</th><th>Quarterly</th><th>Year end</th><th>Final Declaration</th><th>ASA software</th><th>HMRC client relationship</th><th>Action</th></tr></thead><tbody>{rows.length?rows.map((r:any)=>{const status=effectiveStatus(r);const active=status==='authorised';const connection=connectionByAgent.get(r.agent_id);const connected=Boolean(connection?.connected_at);const asaHref=`/api/hmrc/oauth/start?taxpayerId=${encodeURIComponent(id)}&agentId=${encodeURIComponent(r.agent_id)}`;return <tr key={r.id}><td><strong>{r.mtd_agents?.agent_name||'Agent'}</strong><div className="muted">{r.mtd_agents?.organisation_name||''}</div></td><td className="mono">{r.mtd_agents?.hmrc_arn||'Not recorded'}</td><td><span className={`statusPill ${active?'statusDone':'statusOpen'}`}>{status}</span></td><td>{fmt(r.expires_at)}</td><td>{active&&r.can_submit_quarterly?'Allowed':'No'}</td><td>{active&&r.can_manage_year_end?'Allowed':'No'}</td><td>{active&&r.can_submit_final_declaration?'Allowed':'No'}</td><td>{active?<><span className={`statusPill ${connected?'statusDone':'statusOpen'}`}>{connected?'Connected':'Not connected'}</span>{connected&&<div className="muted">Connected {fmt(connection.connected_at)}</div>}<a className="btn btnSmall" href={asaHref}>{connected?'Reconnect ASA':'Connect ASA'}</a><div><a className="muted" href={asaHref}>Open direct ASA link</a></div></>:<span className="muted">No active authority</span>}</td><td>{active&&connected&&r.mtd_agents?.hmrc_arn&&taxpayer?.nino?<details><summary style={{cursor:'pointer',fontWeight:700}}>Check or set up</summary><form method="post" action="/api/agents/hmrc-relationship" style={{marginTop:10,minWidth:220}}><input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="agentId" value={r.agent_id}/><label>Client postcode</label><input className="field" name="knownFact" placeholder="e.g. AA11 1AA" required/><label>Agent type</label><select className="field" name="agentType" defaultValue="main"><option value="main">Main agent</option><option value="supporting">Supporting agent</option></select><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button className="btn btnSmall" type="submit" name="action" value="check">Check HMRC</button>{process.env.HMRC_ENVIRONMENT!=='production'&&<button className="btn btnSmall" type="submit" name="action" value="createSandbox">Create and accept sandbox request</button>}</div></form></details>:<span className="muted">Connect an active ASA and record an ARN first.</span>}</td><td>{active?<form method="post" action="/api/agents/revoke"><input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="authorisationId" value={r.id}/><button className="btn btnSmall" type="submit">Revoke</button></form>:<span className="muted">No active authority</span>}</td></tr>}):<tr><td colSpan={10} className="empty">{unavailable?'Agent authorisations cannot be loaded until database configuration is available.':'No agent authorisations recorded for this taxpayer.'}</td></tr>}</tbody></table></div></section>

    <details className="panel" style={{marginTop:16,marginBottom:16}} open={Boolean(qs.error)}>
      <summary style={{cursor:'pointer',fontWeight:700,fontSize:'1.05rem',listStyle:'none',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}><span>＋ Add new agent</span><span className="muted" style={{fontWeight:400,fontSize:'.9rem'}}>Open form</span></summary>
      <div style={{marginTop:18}}><h2>Add or authorise an agent</h2><p className="muted">HMRC authorisation and MTD Lab permissions are separate controls. Recording an agent here does not itself create HMRC authority. Use the HMRC Agent Services Account relationship where required, then record the relevant reference here.</p>
        <form method="post" action="/api/agents/authorise"><input type="hidden" name="taxpayerId" value={id}/><div className="two"><div><label>Agent name</label><input className="field" name="agentName" required/></div><div><label>Organisation</label><input className="field" name="organisationName"/></div></div><div className="two"><div><label>HMRC Agent Reference Number</label><input className="field" name="hmrcArn" placeholder="Optional until verified"/></div><div><label>Authorisation reference</label><input className="field" name="authorisationReference" placeholder="HMRC or internal reference"/></div></div><div className="two"><div><label>Email</label><input className="field" type="email" name="email"/></div><div><label>Authorisation expires</label><input className="field" type="date" name="expiresAt"/></div></div><h3>Permissions</h3><div className="detailGrid"><label><input type="checkbox" name="canViewRecords" defaultChecked/> View digital records</label><label><input type="checkbox" name="canManageRecords"/> Manage digital records</label><label><input type="checkbox" name="canViewObligations" defaultChecked/> View HMRC obligations</label><label><input type="checkbox" name="canSubmitQuarterly"/> Submit quarterly updates</label><label><input type="checkbox" name="canManageYearEnd"/> Manage year end</label><label><input type="checkbox" name="canSubmitFinalDeclaration"/> Submit Final Declaration</label></div><label>Notes</label><textarea className="field" name="notes" rows={3}/><button className="btn" type="submit">Authorise agent</button></form>
      </div>
    </details>
  </main></div>
}