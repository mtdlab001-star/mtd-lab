'use client'

import { useState } from 'react'

type AgentOption={id:string;label:string}

export default function ActingCapacitySelect({taxpayerId,businessId,incomeSourceType,periodEnd,initialValue,agents}:{taxpayerId:string;businessId:string;incomeSourceType:string;periodEnd:string;initialValue:string;agents:AgentOption[]}){
 const [value,setValue]=useState(initialValue)
 const [status,setStatus]=useState('')
 async function save(nextValue:string){
  setValue(nextValue);setStatus('Saving selection...')
  try{
   const response=await fetch('/api/hmrc/quarterly/draft',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({taxpayerId,businessId,incomeSourceType,periodEnd,actingAgentId:nextValue})})
   if(!response.ok)throw new Error('Save failed')
   setStatus('Selection saved')
  }catch{setStatus('Selection could not be saved. Choose it again before submission.')}
 }
 return <><label htmlFor="actingAgentId">HMRC acting capacity</label><select id="actingAgentId" name="actingAgentId" className="selectField" value={value} onChange={event=>void save(event.target.value)}><option value="">Taxpayer connection</option>{agents.map(agent=><option key={agent.id} value={agent.id}>{agent.label}</option>)}</select>{status&&<p className="muted" role="status">{status}</p>}</>
}
