import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic='force-dynamic'

export default async function AgentsPage(){
  const db=supabaseAdmin()
  const [{data:agents},{data:links}]=await Promise.all([
    db.from('mtd_agents').select('*').order('created_at',{ascending:false}),
    db.from('mtd_agent_authorisations').select('agent_id,status,taxpayer_id')
  ])
  const rows=agents||[]
  const counts=(agentId:string)=>{const all=(links||[]).filter((l:any)=>l.agent_id===agentId);return {all:all.length,active:all.filter((l:any)=>l.status==='authorised').length}}
  return <div className="shell"><aside className="side"><div className="brand">MTD Lab</div><div className="nav"><Link href="/">Dashboard</Link><Link href="/taxpayers">Taxpayers</Link><Link href="/agents">Agents</Link><Link href="/taxpayers/sandbox">Sandbox setup</Link></div><div className="operator">Operated by Glomaxel IT Service</div></aside><main className="main">
    <div className="top"><div><h1 className="pageTitle">Agents</h1><p className="muted">Central view of tax agents and taxpayer specific MTD Lab authorisations.</p></div><span className="badge">Delegated access</span></div>
    <section className="panel" style={{marginTop:24}}><div className="sectionHead"><div><h2>Agent register</h2><p className="muted">An agent must still be separately authorised for each taxpayer and each permitted action.</p></div><strong>{rows.filter((a:any)=>a.status==='active').length} active</strong></div>
      <div className="tableWrap"><table><thead><tr><th>Agent</th><th>Organisation</th><th>HMRC ARN</th><th>Status</th><th>Active taxpayers</th><th>Total relationships</th></tr></thead><tbody>{rows.length?rows.map((a:any)=>{const c=counts(a.id);return <tr key={a.id}><td><strong>{a.agent_name}</strong><div className="muted">{a.email||''}</div></td><td>{a.organisation_name||'Not recorded'}</td><td className="mono">{a.hmrc_arn||'Not recorded'}</td><td><span className={`statusPill ${a.status==='active'?'statusDone':'statusOpen'}`}>{a.status}</span></td><td>{c.active}</td><td>{c.all}</td></tr>}):<tr><td colSpan={6} className="empty">No agents have been registered yet. Open a taxpayer and use Agent Authorisation to add one.</td></tr>}</tbody></table></div>
    </section>
  </main></div>
}
