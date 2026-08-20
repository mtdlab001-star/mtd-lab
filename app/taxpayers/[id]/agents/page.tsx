import TaxpayerSidebar from '@/app/components/TaxpayerSidebar'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic='force-dynamic'
function fmt(v?:string|null){if(!v)return 'Not set';const d=new Date(v);return Number.isNaN(d.getTime())?v:d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
function effectiveStatus(r:any){if(r.status==='authorised'&&r.expires_at&&new Date(r.expires_at).getTime()<=Date.now())return 'expired';if(r.status==='authorised'&&r.mtd_agents?.status&&r.mtd_agents.status!=='active')return 'agent inactive';return r.status}
function isActive(r:any){return effectiveStatus(r)==='authorised'}

export default async function AgentAuthorisationPage({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<Record<string,string|undefined>>}){
  const {id}=await params;const qs=await searchParams;const db=supabaseAdmin();
  const [{data:taxpayer},{data:links}]=await Promise.all([
    db.from('taxpayers').select('id,display_name,nino').eq('id',id).maybeSingle(),
    db.from('mtd_agent_authorisations').select('*,mtd_agents(*)').eq('taxpayer_id',id).order('created_at',{ascending:false})
  ])
  const rows=links||[]
  return <div className="shell"><TaxpayerSidebar taxpayerId={id} active="agents"/><main className="main">
    <div className="top"><div><h1 className="pageTitle">Agent Authorisation</h1><p className="muted">Control which tax agent may act for {taxpayer?.display_name||'this taxpayer'} inside MTD Lab.</p></div><span className="badge">Scoped access</span></div>
    {qs.error&&<div className="status statusError">{qs.error}</div>}{qs.saved&&<div className="status">Agent authorisation saved.</div>}{qs.revoked&&<div className="status">Agent authorisation revoked.</div>}
    <section className="panel" style={{marginTop:20,marginBottom:16}}><h2>Add or authorise an agent</h2><p className="muted">HMRC authorisation and MTD Lab permissions are separate controls. Recording an agent here does not itself create HMRC authority. Use the HMRC Agent Services Account relationship where required, then record the relevant reference here.</p>
      <form method="post" action="/api/agents/authorise">
        <input type="hidden" name="taxpayerId" value={id}/>
        <div className="two"><div><label>Agent name</label><input className="field" name="agentName" required/></div><div><label>Organisation</label><input className="field" name="organisationName"/></div></div>
        <div className="two"><div><label>HMRC Agent Reference Number</label><input className="field" name="hmrcArn" placeholder="Optional until verified"/></div><div><label>Authorisation reference</label><input className="field" name="authorisationReference" placeholder="HMRC or internal reference"/></div></div>
        <div className="two"><div><label>Email</label><input className="field" type="email" name="email"/></div><div><label>Authorisation expires</label><input className="field" type="date" name="expiresAt"/></div></div>
        <h3>Permissions</h3><div className="detailGrid"><label><input type="checkbox" name="canViewRecords" defaultChecked/> View digital records</label><label><input type="checkbox" name="canManageRecords"/> Manage digital records</label><label><input type="checkbox" name="canViewObligations" defaultChecked/> View HMRC obligations</label><label><input type="checkbox" name="canSubmitQuarterly"/> Submit quarterly updates</label><label><input type="checkbox" name="canManageYearEnd"/> Manage year end</label><label><input type="checkbox" name="canSubmitFinalDeclaration"/> Submit Final Declaration</label></div>
        <label>Notes</label><textarea className="field" name="notes" rows={3}/><button className="btn" type="submit">Authorise agent</button>
      </form>
    </section>
    <section className="panel"><div className="sectionHead"><div><h2>Authorised agents</h2><p className="muted">Only active, unexpired authorisations can be used for delegated MTD actions.</p></div><strong>{rows.filter(isActive).length} active</strong></div>
      <div className="tableWrap"><table><thead><tr><th>Agent</th><th>HMRC ARN</th><th>Status</th><th>Expires</th><th>Quarterly</th><th>Year end</th><th>Final Declaration</th><th>Action</th></tr></thead><tbody>{rows.length?rows.map((r:any)=>{const status=effectiveStatus(r);const active=status==='authorised';return <tr key={r.id}><td><strong>{r.mtd_agents?.agent_name||'Agent'}</strong><div className="muted">{r.mtd_agents?.organisation_name||''}</div></td><td className="mono">{r.mtd_agents?.hmrc_arn||'Not recorded'}</td><td><span className={`statusPill ${active?'statusDone':'statusOpen'}`}>{status}</span></td><td>{fmt(r.expires_at)}</td><td>{active&&r.can_submit_quarterly?'Allowed':'No'}</td><td>{active&&r.can_manage_year_end?'Allowed':'No'}</td><td>{active&&r.can_submit_final_declaration?'Allowed':'No'}</td><td>{active?<form method="post" action="/api/agents/revoke"><input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="authorisationId" value={r.id}/><button className="btn btnSmall" type="submit">Revoke</button></form>:<span className="muted">No active authority</span>}</td></tr>}):<tr><td colSpan={8} className="empty">No agent authorisations recorded for this taxpayer.</td></tr>}</tbody></table></div>
    </section>
  </main></div>
}
