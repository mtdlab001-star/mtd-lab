import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { expireAgentAuthorisations } from '@/lib/agent-authorisation'

export const dynamic='force-dynamic'

export default async function AgentsPage(){
  const db=supabaseAdmin();try{await expireAgentAuthorisations()}catch{}
  const [{data:agents},{data:links}]=await Promise.all([
    db.from('mtd_agents').select('*').order('created_at',{ascending:false}),
    db.from('mtd_agent_authorisations').select('agent_id,status,taxpayer_id,expires_at,revoked_at')
  ])
  const rows=agents||[]
  const usable=(l:any)=>l.status==='authorised'&&!l.revoked_at&&(!l.expires_at||new Date(l.expires_at).getTime()>Date.now())
  const counts=(agentId:string)=>{const all=(links||[]).filter((l:any)=>l.agent_id===agentId);return {all:all.length,active:all.filter(usable).length}}
  return <div className="shell"><aside className="side"><div className="brand"><img className="brandLogo" src="/mtd-lab-logo-post-login.svg" alt="MTD Lab"/></div><div className="nav"><Link href="/">Dashboard</Link><Link href="/taxpayers">Taxpayers</Link><Link href="/agents">Agents</Link><Link href="/taxpayers/sandbox">Sandbox setup</Link></div><div className="operator">Operated by Glomaxel IT Service</div></aside><main className="main"><div className="top"><div><h1 className="pageTitle">Agents</h1><p className="muted">Central view of tax agents and taxpayer specific MTD Lab authorisations.</p></div><span className="badge">Delegated access</span></div><section className="panel" style={{marginTop:24}}><div className="sectionHead"><div><h2>Agent register</h2><p className="muted">An agent must be active and separately authorised for each taxpayer and permitted action. Expired relationships are refreshed automatically and excluded from active counts.</p></div><strong>{rows.filter((a:any)=>a.status==='active').length} active agents</strong></div><div className="tableWrap"><table><thead><tr><th>Agent</th><th>Organisation</th><th>HMRC ARN</th><th>Status</th><th>Active taxpayers</th><th>Total relationships</th></tr></thead><tbody>{rows.length?rows.map((a:any)=>{const c=counts(a.id);return <tr key={a.id}><td><strong>{a.agent_name}</strong><div className="muted">{a.email||''}</div></td><td>{a.organisation_name||'Not recorded'}</td><td className="mono">{a.hmrc_arn||'Not recorded'}</td><td><span className={`statusPill ${a.status==='active'?'statusDone':'statusOpen'}`}>{a.status}</span></td><td>{a.status==='active'?c.active:0}</td><td>{c.all}</td></tr>}):<tr><td colSpan={6} className="empty">No agents have been registered yet. Open a taxpayer and use Agent Authorisation to add one.</td></tr>}</tbody></table></div></section></main></div>
}
