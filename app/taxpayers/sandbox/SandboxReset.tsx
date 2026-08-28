'use client'

import { useState } from 'react'

const PHRASE = 'RESET MTD LAB SANDBOX'

export default function SandboxReset(){
  const [confirmation,setConfirmation]=useState('')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')

  async function reset(){
    if(confirmation!==PHRASE)return
    if(!window.confirm('This permanently removes all MTD Lab sandbox taxpayers, agents, OAuth connections and related filing test records. Continue?'))return
    setBusy(true);setMessage('');setError('')
    try{
      const response=await fetch('/api/sandbox/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmation})})
      const data=await response.json().catch(()=>({}))
      if(!response.ok)throw new Error(data?.error||`Reset failed (${response.status})`)
      setMessage(`Reset complete. Removed ${data.removedTaxpayers||0} taxpayer workspace(s) and ${data.removedAgents||0} agent record(s).`)
      setConfirmation('')
      setTimeout(()=>window.location.reload(),900)
    }catch(e:any){setError(e?.message||'Sandbox reset failed.')}
    finally{setBusy(false)}
  }

  return <section className="panel" style={{marginBottom:16,borderColor:'rgba(239,68,68,.55)'}}>
    <h2>Reset MTD Lab sandbox</h2>
    <p className="muted">Removes all local sandbox taxpayers, agents, HMRC OAuth connections, authorisations and related filing test records. It does not delete HMRC test identities and does not change application configuration or login accounts.</p>
    <label>Type <strong>{PHRASE}</strong> to confirm</label>
    <input className="field" value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="off"/>
    <button className="btn" type="button" disabled={busy||confirmation!==PHRASE} onClick={reset}>{busy?'Resetting…':'Reset sandbox data'}</button>
    {message?<div className="status" style={{marginTop:12}}>{message}</div>:null}
    {error?<div className="status statusError" style={{marginTop:12}}>{error}</div>:null}
  </section>
}
