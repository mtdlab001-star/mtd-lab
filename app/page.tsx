import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

function fmtDate(value?: string | null) {
  if (!value) return 'Not synced'
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default async function Home(){
  let taxpayerCount=0
  let businessCount=0
  let obligationCount=0
  let openCount=0
  let nextDue:string|null=null
  let connected=false
  try {
    const db=supabaseAdmin()
    const [{count:t},{count:b},{data:o},{data:c}] = await Promise.all([
      db.from('taxpayers').select('*',{count:'exact',head:true}),
      db.from('hmrc_businesses').select('*',{count:'exact',head:true}),
      db.from('hmrc_obligations').select('due_date,status'),
      db.from('hmrc_connections').select('id').limit(1)
    ])
    taxpayerCount=t||0
    businessCount=b||0
    obligationCount=o?.length||0
    const open=(o||[]).filter((x:any)=>String(x.status).toLowerCase()==='open')
    openCount=open.length
    nextDue=open.map((x:any)=>x.due_date).filter(Boolean).sort()[0]||null
    connected=!!c?.length
  } catch {}

  return <div className="shell">
    <aside className="side">
      <div className="brand">MTD Lab</div>
      <div className="nav"><Link href="/">Dashboard</Link><Link href="/taxpayers">Taxpayers</Link><Link href="/taxpayers/demo#connection">HMRC Connection</Link><Link href="/taxpayers/demo#sync">Synchronise HMRC</Link><Link href="/taxpayers/demo#obligations">MTD Obligations</Link></div>
      <div className="operator">Operated by Glomaxel IT Service</div>
    </aside>
    <main className="main">
      <div className="top"><div><h1 className="pageTitle">Making Tax Digital workspace</h1><p className="muted">HMRC sandbox dashboard for MTD Income Tax development.</p></div><span className={connected?'badge':'badge badgeMuted'}>{connected?'HMRC Connected':'HMRC Not Connected'}</span></div>
      <div className="cards">
        <div className="card"><span className="eyebrow">Taxpayers</span><strong>{taxpayerCount}</strong><span className="muted">Configured workspaces</span></div>
        <div className="card"><span className="eyebrow">Businesses</span><strong>{businessCount}</strong><span className="muted">HMRC income sources</span></div>
        <div className="card"><span className="eyebrow">Open obligations</span><strong>{openCount}</strong><span className="muted">of {obligationCount} total</span></div>
        <div className="card"><span className="eyebrow">Next due</span><strong className="dateValue">{fmtDate(nextDue)}</strong><span className="muted">Earliest open obligation</span></div>
      </div>
      <div className="two">
        <section className="panel"><h2>HMRC sandbox taxpayer</h2><p className="muted">Open the connected sandbox taxpayer, review obligations and refresh HMRC data.</p><Link className="btn" href="/taxpayers/demo">Open taxpayer workspace</Link></section>
        <section className="panel"><h2>Development status</h2><p><span className="statusPill statusDone">OAuth working</span></p><p className="muted">The app is connected to the HMRC sandbox and can retrieve business income sources and obligation periods.</p></section>
      </div>
    </main>
  </div>
}
