'use client'

import { useState } from 'react'

type AgentOption={id:string,name:string,hmrcArn:string}

export default function CreateSandboxAgent({agents}:{agents:AgentOption[]}){
  const [busy,setBusy]=useState(false)
  const [linkBusy,setLinkBusy]=useState(false)
  const [result,setResult]=useState<any>(null)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  const [agentId,setAgentId]=useState(agents[0]?.id||'')
  const [manualArn,setManualArn]=useState('')

  async function create(){
    if(!confirm('Create a new HMRC sandbox Agent test user? The generated credentials should be stored securely.')) return
    setBusy(true);setError('');setMessage('');setResult(null)
    try{
      const r=await fetch('/api/agents/create-test-agent',{method:'POST'})
      const j=await r.json()
      if(!r.ok) throw new Error(j.error||'Unable to create HMRC sandbox agent')
      setResult(j)
      setManualArn(j.agentServicesAccountNumber||'')
    }catch(e:any){setError(e.message||'Unable to create HMRC sandbox agent')}
    finally{setBusy(false)}
  }

  async function link(){
    if(!agentId||!manualArn.trim()){setError('Choose the MTD Lab agent and enter the HMRC Agent Services Account number.');return}
    setLinkBusy(true);setError('');setMessage('')
    try{
      const r=await fetch('/api/agents/link-sandbox-agent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({agentId,arn:manualArn})})
      const j=await r.json()
      if(!r.ok) throw new Error(j.error||'Unable to link sandbox agent identity')
      setMessage(`${j.agentName} is now linked to HMRC sandbox agent ${j.hmrcArn}. Refresh this page before testing the client relationship.`)
    }catch(e:any){setError(e.message||'Unable to link sandbox agent identity')}
    finally{setLinkBusy(false)}
  }

  return <section className="panel" style={{marginTop:24}}>
    <div className="sectionHead"><div><h2>HMRC sandbox agent</h2><p className="muted">Create a genuine HMRC Agent test user enrolled for agent services. The HMRC Agent Services Account number must also match the MTD Lab agent record used for the ASA connection.</p></div></div>
    <button className="btn" type="button" onClick={create} disabled={busy}>{busy?'Creating…':'Create HMRC sandbox agent'}</button>
    {error&&<div className="errorBox" style={{marginTop:16}}>{error}</div>}
    {message&&<div className="successBox" style={{marginTop:16}}>{message}</div>}
    {result&&<div className="panel" style={{marginTop:16}}><h3>Sandbox agent created</h3><p className="muted">Copy these credentials now. They are test credentials and should not be exposed publicly.</p><div className="tableWrap"><table><tbody><tr><th>User ID</th><td className="mono">{result.userId}</td></tr><tr><th>Password</th><td className="mono">{result.password}</td></tr><tr><th>Name</th><td>{result.userFullName||'Not returned'}</td></tr><tr><th>Email</th><td>{result.emailAddress||'Not returned'}</td></tr><tr><th>Agent Services Account number</th><td className="mono">{result.agentServicesAccountNumber||'Not returned'}</td></tr></tbody></table></div></div>}
    <div className="panel" style={{marginTop:16}}><h3>Link HMRC sandbox identity</h3><p className="muted">Use the Agent Services Account number from the exact sandbox agent that successfully signed in during Reconnect ASA. This replaces an old or mismatched HMRC ARN on the selected MTD Lab agent.</p><div className="grid2"><label>MTD Lab agent<select value={agentId} onChange={e=>setAgentId(e.target.value)}>{agents.map(a=><option key={a.id} value={a.id}>{a.name}{a.hmrcArn?` (${a.hmrcArn})`:''}</option>)}</select></label><label>HMRC Agent Services Account number<input value={manualArn} onChange={e=>setManualArn(e.target.value.toUpperCase())} placeholder="e.g. CARN1234567"/></label></div><button className="btn" type="button" onClick={link} disabled={linkBusy||!agents.length} style={{marginTop:12}}>{linkBusy?'Linking…':'Link sandbox identity'}</button></div>
  </section>
}
