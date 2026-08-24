'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Props = {
  taxpayerId: string
  clientName: string
  archived?: boolean
}

export default function TaxpayerActions({ taxpayerId, clientName, archived = false }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<ClientAction | null>(null)
  const [showDelete, setShowDelete] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')

  type ClientAction = 'archive' | 'restore' | 'delete'

  async function run(action: ClientAction) {
    setBusy(action)
    setError('')
    try {
      const response = await fetch('/api/taxpayers/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taxpayerId, action, confirmation: action === 'delete' ? confirmation : undefined }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result?.error || 'The client action could not be completed')
      if (action === 'delete') {
        setShowDelete(false)
        setConfirmation('')
      }
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The client action could not be completed')
    } finally {
      setBusy(null)
    }
  }

  return <>
    <div className="clientActions">
      <button className="btn btnSmall" type="button" disabled={busy !== null} onClick={() => run(archived ? 'restore' : 'archive')}>
        {busy === (archived ? 'restore' : 'archive') ? 'Working…' : archived ? 'Restore' : 'Archive'}
      </button>
      <button className="btn btnSmall btnDangerSecondary" type="button" disabled={busy !== null} onClick={() => { setError(''); setShowDelete(true) }}>
        Remove
      </button>
    </div>
    {error && !showDelete && <div className="clientActionError">{error}</div>}
    {showDelete && <div className="modalBackdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setShowDelete(false) }}>
      <section className="confirmModal" role="dialog" aria-modal="true" aria-labelledby={`delete-title-${taxpayerId}`}>
        <h2 id={`delete-title-${taxpayerId}`}>Permanently remove {clientName}?</h2>
        <div className="status statusError">
          This cannot be undone. Taxpayer records, HMRC connections, businesses, obligations, submissions, sync runs, digital records and audit history may be permanently deleted.
        </div>
        <p className="muted">Archive is the safer choice because it hides the client while keeping all HMRC and filing history.</p>
        <label htmlFor={`delete-confirm-${taxpayerId}`}>Type <strong>{clientName}</strong> to confirm</label>
        <input id={`delete-confirm-${taxpayerId}`} className="field" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" autoFocus/>
        {error && <div className="clientActionError">{error}</div>}
        <div className="modalActions">
          <button className="btn btnSmall btnDanger" type="button" disabled={confirmation !== clientName || busy !== null} onClick={() => run('delete')}>
            {busy === 'delete' ? 'Deleting…' : 'Permanently delete'}
          </button>
          <button className="btn btnSmall btnSecondary" type="button" disabled={busy !== null} onClick={() => { setShowDelete(false); setConfirmation(''); setError('') }}>Cancel</button>
        </div>
      </section>
    </div>}
  </>
}
