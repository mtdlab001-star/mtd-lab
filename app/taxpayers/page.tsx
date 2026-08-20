import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export default async function TaxpayersPage() {
  let taxpayers:any[]=[]
  try {
    const db=supabaseAdmin()
    const { data } = await db.from('taxpayers').select('*').order('created_at',{ascending:true})
    taxpayers=data||[]
  } catch {}

  return <div className="shell">
    <aside className="side">
      <div className="brand">MTD Lab</div>
      <div className="nav"><Link href="/">Dashboard</Link><Link href="/taxpayers">Taxpayers</Link><Link href="/agents">Agents</Link><Link href="/taxpayers/sandbox">Sandbox setup</Link></div>
      <div className="operator">Operated by Glomaxel IT Service</div>
    </aside>
    <main className="main">
      <div className="top"><div><h1 className="pageTitle">Taxpayers</h1><p className="muted">Manage HMRC MTD taxpayer workspaces.</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link className="btn btnSmall" href="/agents">Manage agents</Link><Link className="btn" href="/taxpayers/sandbox">Add HMRC sandbox taxpayer</Link></div></div>
      <section className="panel" style={{marginTop:24}}>
        <div className="sectionHead"><div><h2>Taxpayer workspaces</h2><p className="muted">Open a taxpayer to view HMRC connection, businesses and obligations.</p></div></div>
        <div className="tableWrap"><table><thead><tr><th>Name</th><th>NINO</th><th>MTD Income Tax ID</th><th></th></tr></thead><tbody>{taxpayers.length?taxpayers.map(t=><tr key={t.id}><td><strong>{t.display_name}</strong></td><td className="mono">{t.nino||'Not saved'}</td><td className="mono">{t.mtditid||'Not saved'}</td><td><Link className="btn btnSmall" href={`/taxpayers/${encodeURIComponent(t.id)}`}>Open</Link></td></tr>):<tr><td colSpan={4} className="empty">No taxpayers found.</td></tr>}</tbody></table></div>
      </section>
    </main>
  </div>
}
