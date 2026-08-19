import Link from 'next/link'

export default function SandboxTaxpayerPage(){
  return <div className="shell">
    <aside className="side">
      <div className="brand">MTD Lab</div>
      <div className="nav"><Link href="/">Dashboard</Link><Link href="/taxpayers">Taxpayers</Link><span>Sandbox setup</span></div>
      <div className="operator">Operated by Glomaxel IT Service</div>
    </aside>
    <main className="main">
      <div className="top"><div><h1 className="pageTitle">HMRC sandbox taxpayer setup</h1><p className="muted">Create a fresh HMRC test individual, save only the tax identifiers in MTD Lab, then authorise the same test user through HMRC OAuth.</p></div><span className="badge">Sandbox only</span></div>
      <section className="panel" style={{marginTop:20,marginBottom:16}}>
        <h2>1. Create a fresh HMRC test individual</h2>
        <p className="muted">HMRC generates the Government Gateway test user ID, password, NINO and Making Tax Digital Income Tax ID. Keep the generated user ID and password outside MTD Lab. They are only needed when signing in to HMRC during the authorisation journey.</p>
        <a className="btn" href="https://developer.service.hmrc.gov.uk/api-test-user" target="_blank" rel="noreferrer">Open HMRC test user service</a>
      </section>
      <section className="panel">
        <h2>2. Add the generated taxpayer to MTD Lab</h2>
        <p className="muted">Enter the generated NINO and MTD Income Tax ID. MTD Lab does not ask for or store the HMRC test password.</p>
        <form method="post" action="/api/taxpayers/sandbox">
          <label>Workspace name</label><input className="field" name="displayName" defaultValue="HMRC Sandbox Taxpayer" required/>
          <label>NINO</label><input className="field" name="nino" placeholder="AB123456C" required/>
          <label>MTD Income Tax ID</label><input className="field" name="mtditid" placeholder="XAIT00000000000" required/>
          <button className="btn" type="submit">Create taxpayer workspace</button>
        </form>
      </section>
      <div className="status">After the workspace is created, use Connect to HMRC and sign in with the same HMRC sandbox test user credentials that generated these tax identifiers.</div>
    </main>
  </div>
}
