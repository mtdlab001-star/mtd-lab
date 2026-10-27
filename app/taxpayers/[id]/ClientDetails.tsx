'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import TaxpayerActions from '@/app/taxpayers/TaxpayerActions'

type Props = {
  taxpayerId: string
  displayName: string
  nino: string
  mtditid: string
  archived: boolean
}

export default function ClientDetails({ taxpayerId, displayName, nino, mtditid, archived }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ displayName, nino, mtditid })

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/taxpayers/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taxpayerId, ...form }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result?.error || 'Client details could not be updated')
      setEditing(false)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Client details could not be updated')
    } finally {
      setBusy(false)
    }
  }

  function cancel() {
    setForm({ displayName, nino, mtditid })
    setError('')
    setEditing(false)
  }

  return <section className="panel clientDetailsPanel">
    <div className="sectionHead">
      <div><span className="eyebrow">Client record</span><h2>Client details</h2><p className="muted">Review the client before making any changes.</p></div>
      {!editing&&<button className="btn btnSmall" type="button" onClick={()=>setEditing(true)}>Edit</button>}
    </div>
    {editing?<form onSubmit={save} className="clientEditForm">
      <label>Client name<input className="field" value={form.displayName} onChange={event=>setForm(current=>({...current,displayName:event.target.value}))} maxLength={120} required/></label>
      <label>NI number<input className="field" value={form.nino} onChange={event=>setForm(current=>({...current,nino:event.target.value}))} placeholder="AB123456C" autoCapitalize="characters"/></label>
      <label>MTD Income Tax ID<input className="field" value={form.mtditid} onChange={event=>setForm(current=>({...current,mtditid:event.target.value}))} placeholder="15 characters" autoCapitalize="characters"/></label>
      {error&&<div className="status statusError">{error}</div>}
      <div className="clientActions"><button className="btn btnSmall" type="submit" disabled={busy}>{busy?'Saving…':'Save changes'}</button><button className="btn btnSmall btnSecondary" type="button" disabled={busy} onClick={cancel}>Cancel</button></div>
    </form>:<div className="clientDetailsGrid">
      <div><span className="eyebrow">Client name</span><strong>{displayName}</strong></div>
      <div><span className="eyebrow">NI number</span><strong className="mono">{nino||'Not saved'}</strong></div>
      <div><span className="eyebrow">MTD Income Tax ID</span><strong className="mono">{mtditid||'Not saved'}</strong></div>
      <div><span className="eyebrow">Status</span><strong>{archived?'Archived':'Active'}</strong></div>
    </div>}
    <details className="technicalDetails clientManagement">
      <summary>Archive, restore or remove this client</summary>
      <p className="muted">Archiving keeps the client’s HMRC connections, records and filing history. Permanent removal requires the client name to be entered exactly.</p>
      <TaxpayerActions taxpayerId={taxpayerId} clientName={displayName} archived={archived} returnToList/>
    </details>
  </section>
}
