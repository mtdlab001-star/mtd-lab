import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic='force-dynamic'

const checks=[
  {title:'API version health',text:'Confirm every HMRC API family is using the centrally approved media type version.',href:'/api/hmrc/version-health',action:'Open version health'},
  {title:'OAuth authorisation',text:'Create the taxpayer workspace, connect to HMRC and authorise with the same sandbox test user.',href:'/taxpayers',action:'Open taxpayers'},
  {title:'Business details and obligations',text:'Synchronise HMRC and confirm modern MTD obligations from 2025/26 onward are retrieved for the selected income sources.',href:'/taxpayers',action:'Open taxpayer workspace'},
  {title:'Digital records and quarterly update',text:'Add digital records, prepare cumulative totals, review the quarterly update and submit it to HMRC sandbox.',href:'/taxpayers',action:'Open filing workflow'},
  {title:'Post submission reconciliation',text:'Confirm an accepted update shows as accepted while HMRC obligation status is refreshing, then synchronise again and verify fulfilment when HMRC updates it.',href:'/taxpayers',action:'Open submission history'},
  {title:'Tax calculation',text:'Trigger an HMRC calculation, retrieve the completed result and confirm the calculation is written to the submission audit trail.',href:'/taxpayers',action:'Open calculations'},
  {title:'Year end and Final Declaration',text:'Complete the required year end reviews, retrieve the final calculation and validate the guarded Final Declaration journey after the tax year has ended.',href:'/taxpayers',action:'Open year end'},
]

export default async function SandboxTaxpayerPage(){
  let metrics={workspaces:0,connections:0,syncs:0,quarterly:0,calculations:0,finalDeclarations:0}
  try{
    const db=supabaseAdmin()
    const [t,c,s,q,calc,finals]=await Promise.all([
      db.from('taxpayers').select('id',{count:'exact',head:true}),
      db.from('hmrc_connections').select('id',{count:'exact',head:true}),
      db.from('hmrc_sync_runs').select('id',{count:'exact',head:true}).eq('status','complete'),
      db.from('hmrc_quarterly_submissions').select('id',{count:'exact',head:true}).eq('status','submitted'),
      db.from('mtd_submission_audit').select('id',{count:'exact',head:true}).eq('event_type','tax_calculation_retrieval').eq('status','accepted'),
      db.from('mtd_submission_audit').select('id',{count:'exact',head:true}).eq('event_type','final_declaration').eq('status','accepted'),
    ])
    metrics={workspaces:t.count||0,connections:c.count||0,syncs:s.count||0,quarterly:q.count||0,calculations:calc.count||0,finalDeclarations:finals.count||0}
  }catch{}
  return <div className="shell">
    <aside className="side">
      <div className="brand">MTD Lab</div>
      <div className="nav"><Link href="/">Dashboard</Link><Link href="/taxpayers">Taxpayers</Link><span>Sandbox setup</span></div>
      <div className="operator">Operated by Glomaxel IT Service</div>
    </aside>
    <main className="main">
      <div className="top"><div><h1 className="pageTitle">HMRC sandbox taxpayer setup</h1><p className="muted">Create a fresh HMRC test individual, save only the tax identifiers in MTD Lab, then validate the complete Stage 2 Income Tax journey.</p></div><span className="badge">Sandbox only</span></div>
      <div className="grid3" style={{marginTop:20,marginBottom:16}}>
        <section className="panel"><div className="muted">Taxpayer workspaces</div><div className="metric">{metrics.workspaces}</div></section>
        <section className="panel"><div className="muted">HMRC connections</div><div className="metric">{metrics.connections}</div></section>
        <section className="panel"><div className="muted">Successful HMRC syncs</div><div className="metric">{metrics.syncs}</div></section>
        <section className="panel"><div className="muted">Accepted quarterly updates</div><div className="metric">{metrics.quarterly}</div></section>
        <section className="panel"><div className="muted">Calculations retrieved</div><div className="metric">{metrics.calculations}</div></section>
        <section className="panel"><div className="muted">Final Declarations accepted</div><div className="metric">{metrics.finalDeclarations}</div></section>
      </div>
      <section className="panel" style={{marginBottom:16}}>
        <h2>1. Create a fresh HMRC test individual</h2>
        <p className="muted">HMRC generates the Government Gateway test user ID, password, NINO and Making Tax Digital Income Tax ID. Keep the generated user ID and password outside MTD Lab. They are only needed when signing in to HMRC during the authorisation journey.</p>
        <a className="btn" href="https://developer.service.hmrc.gov.uk/api-test-user" target="_blank" rel="noreferrer">Open HMRC test user service</a>
      </section>
      <section className="panel" style={{marginBottom:16}}>
        <h2>2. Add the generated taxpayer to MTD Lab</h2>
        <p className="muted">Enter the generated NINO and MTD Income Tax ID. MTD Lab does not ask for or store the HMRC test password.</p>
        <form method="post" action="/api/taxpayers/sandbox">
          <label>Workspace name</label><input className="field" name="displayName" defaultValue="HMRC Sandbox Taxpayer" required/>
          <label>NINO</label><input className="field" name="nino" placeholder="AB123456C" required/>
          <label>MTD Income Tax ID</label><input className="field" name="mtditid" placeholder="XAIT00000000000" required/>
          <button className="btn" type="submit">Create taxpayer workspace</button>
        </form>
      </section>
      <section className="panel">
        <div className="sectionHead"><div><h2>3. Stage 2 validation checklist</h2><p className="muted">Run these checks in order before treating the sandbox journey as release ready.</p></div><a className="btn btnSmall" href="/api/hmrc/version-health" target="_blank" rel="noreferrer">Version health</a></div>
        <div className="tableWrap"><table><thead><tr><th>Check</th><th>Expected validation</th><th>Open</th></tr></thead><tbody>{checks.map((c,index)=><tr key={c.title}><td><strong>{index+1}. {c.title}</strong></td><td>{c.text}</td><td><Link className="btn btnSmall" href={c.href}>{c.action}</Link></td></tr>)}</tbody></table></div>
      </section>
      <div className="status">The counters above reflect recorded Stage 2 activity in MTD Lab. Production submissions remain separately controlled and must not be enabled simply because sandbox counters are nonzero.</div>
    </main>
  </div>
}
