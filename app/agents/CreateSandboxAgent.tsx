'use client'

import { useState } from 'react'

export default function CreateSandboxAgent(){
  const [busy,setBusy]=useState(false)
  const [result,setResult]=useState<any>(null)
  const [error,setError]=useState('')

  async function create(){
    if(!confirm('Create a new HMRC sandbox Agent test user? The generated credentials should be stored securely.')) return
    setBusy(true);setError('');setResult(null)
    try{
      const r=await fetch('/api/agents/create-test-agent',{method:'POST'})
      const j=await r.json()
      if(!r.ok) throw new Error(j.error||'Unable to create HMRC sandbox agent')
      setResult(j)
    }catch(e:any){setError(e.message||'Unable to create HMRC sandbox agent')}
    finally{setBusy(false)}
  }

  return <section className="panel" style={{marginTop:24}}>
    <div className="sectionHead"><div><h2>HMRC sandbox agent</h2><p className="muted">Create a genuine HMRC Agent test user enrolled for agent services. Use the returned User ID and password when reconnecting the ASA.</p></div></div>
    <button className="btn" type="button" onClick={create} disabled={busy}>{busy?'Creating…':'Create HMRC sandbox agent'}</button>
    {error&&<div className="errorBox" style={{marginTop:16}}>{error}</div>}
    {result&&<div className="panel" style={{marginTop:16}}><h3>Sandbox agent created</h3><p className="muted">Copy these credentials now. They are test credentials and should not be exposed publicly.</p><div className="tableWrap"><table><tbody><tr><th>User ID</th><td className="mono">{result.userId}</td></tr><tr><th>Password</th><td className="mono">{result.password}</td></tr><tr><th>Name</th><td>{result.userFullName||'Not returned'}</td></tr><tr><th>Email</th><td>{result.emailAddress||'Not returned'}</td></tr><tr><th>Agent Services Account number</th><td className="mono">{result.agentServicesAccountNumber||'Not returned'}</td></tr></tbody></table></div><p className="muted" style={{marginTop:12}}>Next: use this exact User ID and password during Reconnect ASA. Do not use the taxpayer sandbox credentials.</p></div>}
  </section>
}
