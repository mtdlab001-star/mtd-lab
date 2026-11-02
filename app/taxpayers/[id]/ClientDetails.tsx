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
  qualifyingIncome: number | null
  qualifyingIncomeTaxYear: string
  mtdSignupStatus: string
  mtdExemptionStatus: string
  previousReturnSubmitted: boolean | null
}

export default function ClientDetails({ taxpayerId, displayName, nino, mtditid, archived, qualifyingIncome, qualifyingIncomeTaxYear, mtdSignupStatus, mtdExemptionStatus, previousReturnSubmitted }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ displayName, nino, mtditid, qualifyingIncome: qualifyingIncome?.toString()||'', qualifyingIncomeTaxYear, mtdSignupStatus, mtdExemptionStatus, previousReturnSubmitted: previousReturnSubmitted===null?'unknown':previousReturnSubmitted?'yes':'no' })

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
    setForm({ displayName, nino, mtditid, qualifyingIncome: qualifyingIncome?.toString()||'', qualifyingIncomeTaxYear, mtdSignupStatus, mtdExemptionStatus, previousReturnSubmitted: previousReturnSubmitted===null?'unknown':previousReturnSubmitted?'yes':'no' })
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
      <label>Qualifying income (£)<input className="field" type="number" min="0" step="0.01" value={form.qualifyingIncome} onChange={event=>setForm(current=>({...current,qualifyingIncome:event.target.value}))} placeholder="Self-employment and property income"/></label>
      <label>Income test tax year<input className="field" value={form.qualifyingIncomeTaxYear} onChange={event=>setForm(current=>({...current,qualifyingIncomeTaxYear:event.target.value}))} placeholder="2025-26" pattern="20[0-9]{2}-[0-9]{2}"/></label>
      <label>MTD sign-up status<select className="field" value={form.mtdSignupStatus} onChange={event=>setForm(current=>({...current,mtdSignupStatus:event.target.value}))}><option value="not_checked">Not checked</option><option value="not_required">Not required yet</option><option value="needs_signup">Needs sign-up</option><option value="signed_up">Signed up</option></select></label>
      <label>Exemption status<select className="field" value={form.mtdExemptionStatus} onChange={event=>setForm(current=>({...current,mtdExemptionStatus:event.target.value}))}><option value="not_assessed">Not assessed</option><option value="not_exempt">Not exempt</option><option value="application_pending">Application pending</option><option value="approved">Approved</option></select></label>
      <label>Previous Self Assessment return<select className="field" value={form.previousReturnSubmitted} onChange={event=>setForm(current=>({...current,previousReturnSubmitted:event.target.value}))}><option value="unknown">Not checked</option><option value="yes">Submitted</option><option value="no">Not submitted</option></select></label>
      {error&&<div className="status statusError">{error}</div>}
      <div className="clientActions"><button className="btn btnSmall" type="submit" disabled={busy}>{busy?'Saving…':'Save changes'}</button><button className="btn btnSmall btnSecondary" type="button" disabled={busy} onClick={cancel}>Cancel</button></div>
    </form>:<div className="clientDetailsGrid">
      <div><span className="eyebrow">Client name</span><strong>{displayName}</strong></div>
      <div><span className="eyebrow">NI number</span><strong className="mono">{nino||'Not saved'}</strong></div>
      <div><span className="eyebrow">MTD Income Tax ID</span><strong className="mono">{mtditid||'Not saved'}</strong></div>
      <div><span className="eyebrow">Status</span><strong>{archived?'Archived':'Active'}</strong></div>
      <div><span className="eyebrow">Qualifying income</span><strong>{qualifyingIncome===null?'Not checked':new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(qualifyingIncome)}</strong></div>
      <div><span className="eyebrow">Income test year</span><strong>{qualifyingIncomeTaxYear||'Not checked'}</strong></div>
      <div><span className="eyebrow">MTD sign-up</span><strong>{mtdSignupStatus.replaceAll('_',' ')}</strong></div>
      <div><span className="eyebrow">Exemption</span><strong>{mtdExemptionStatus.replaceAll('_',' ')}</strong></div>
      <div><span className="eyebrow">Previous return</span><strong>{previousReturnSubmitted===null?'Not checked':previousReturnSubmitted?'Submitted':'Not submitted'}</strong></div>
    </div>}
    <div className="status"><strong>MTD income thresholds</strong><div className="muted">Over £50,000 starts from 6 April 2026, over £30,000 from 6 April 2027, and over £20,000 from 6 April 2028. Confirm sign-up or an approved exemption before production filing.</div></div>
    <details className="technicalDetails clientManagement">
      <summary>Archive, restore or remove this client</summary>
      <p className="muted">Archiving keeps the client’s HMRC connections, records and filing history. Permanent removal requires the client name to be entered exactly.</p>
      <TaxpayerActions taxpayerId={taxpayerId} clientName={displayName} archived={archived} returnToList/>
    </details>
  </section>
}
