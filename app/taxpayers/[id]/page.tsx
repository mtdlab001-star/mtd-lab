import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'
import TaxpayerSidebar from '@/app/components/TaxpayerSidebar'
import { assessHmrcConnection } from '@/lib/hmrc-connection-status'
import type { MtdIncomeSourceType } from '@/lib/mtd-income-source'
import { mergeMtdIncomeSources } from '@/lib/mtd-income-sources-server'
import { quarterlyPeriodIsAvailable } from '@/lib/quarterly-submission-eligibility'

export const dynamic = 'force-dynamic'

function fmtDate(value?: string | null) {
  if (!value) return 'Not available'
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtShortDate(value?: string | null) {
  if (!value) return '-'
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-GB')
}

function taxYearFor(value?: string | null) {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  const start = m > 4 || (m === 4 && d >= 6) ? y : y - 1
  return `${start}-${String(start + 1).slice(-2)}`
}

function annualDueDate(taxYear?: string | null) {
  const start = Number(String(taxYear || '').slice(0, 4))
  return Number.isFinite(start) ? `${start + 2}-01-31` : null
}

function annualStatus(taxYear?: string | null) {
  const due = annualDueDate(taxYear)
  if (!due) return 'Not due yet'
  return new Date(`${due}T23:59:59Z`).getTime() < Date.now() ? 'Over Due' : 'Not due yet'
}

function acceptedSubmissionFor(submissions: any[], obligation: any) {
  return submissions.find((s: any) => s.status === 'submitted' && s.period_end === obligation.period_end && (!obligation.business_id || s.business_id === obligation.business_id))
}

function submissionDate(submission?: any) {
  return submission ? new Date(submission.submitted_at || submission.created_at).toLocaleString('en-GB') : '-'
}

function obligationIncomeSourceType(businessId?: string | null) {
  const id = String(businessId || '').toUpperCase()
  if (id.startsWith('XFIS')) return 'foreign-property'
  if (id.startsWith('XPIS')) return 'uk-property'
  return 'self-employment'
}

function sourceAnnualLabel(sourceType: MtdIncomeSourceType) {
  if (sourceType === 'uk-property') return 'UK Property Annual Submission'
  if (sourceType === 'foreign-property') return 'Foreign Property Annual Submission'
  return 'Self-Employment Annual Submission'
}

function quarterLabel(obligation: any, index: number) {
  const end = String(obligation.period_end || '')
  if (end.endsWith('-07-05')) return 'Quarter 1'
  if (end.endsWith('-10-05')) return 'Quarter 2'
  if (end.endsWith('-01-05')) return 'Quarter 3'
  if (end.endsWith('-04-05')) return 'Quarter 4'
  return `Quarter ${index + 1}`
}

function displayStatus(obligation: any, submission?: any) {
  const hmrc = String(obligation.status || '').toLowerCase()
  if (submission) return { label: 'Submitted', cls: 'statusDone' }
  if (hmrc === 'fulfilled') return { label: 'Fulfilled', cls: 'statusDone' }
  const due = obligation.due_date ? new Date(`${obligation.due_date}T23:59:59Z`).getTime() : null
  if (due && due < Date.now()) return { label: 'Over Due', cls: 'statusError' }
  return { label: 'Not due yet', cls: 'statusOpen' }
}

export default async function TaxpayerPage({ params, searchParams }: { params: Promise<{id:string}>, searchParams: Promise<Record<string,string|undefined>> }) {
  const { id } = await params
  const qs = await searchParams
  let taxpayer: any = { id, display_name: id === 'demo' ? 'HMRC Sandbox Taxpayer' : id, nino: '', mtditid: '' }
  let businesses: any[] = []
  let obligations: any[] = []
  let submissions: any[] = []
  let connection: any = null
  let syncStatus = 'Not synced'
  let lastSync: string | null = null
  let lastSuccessfulSync: string | null = null
  let syncError: string | null = null

  try {
    const db = supabaseAdmin()
    const [{data:t},{data:b},{data:o},{data:q},{data:c},{data:s},{data:lastGood}] = await Promise.all([
      db.from('taxpayers').select('*').eq('id',id).maybeSingle(),
      db.from('hmrc_businesses').select('*').eq('taxpayer_id',id).order('created_at'),
      db.from('hmrc_obligations').select('*').eq('taxpayer_id',id).order('due_date',{ascending:true}),
      db.from('hmrc_quarterly_submissions').select('business_id,period_end,status,submitted_at,created_at').eq('taxpayer_id',id).eq('status','submitted').order('created_at',{ascending:false}),
      db.from('hmrc_connections').select('access_token,refresh_token,token_expires_at,connected_at,scope').eq('taxpayer_id',id).maybeSingle(),
      db.from('hmrc_sync_runs').select('status,error_message,completed_at').eq('taxpayer_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
      db.from('hmrc_sync_runs').select('completed_at').eq('taxpayer_id',id).eq('status','complete').order('created_at',{ascending:false}).limit(1).maybeSingle()
    ])
    if (t) taxpayer = t
    businesses = b || []
    obligations = o || []
    submissions = q || []
    connection = c
    syncStatus = s?.status === 'complete' ? 'Complete' : s?.status === 'failed' ? 'Latest sync failed' : 'Not synced'
    lastSync = s?.completed_at || null
    syncError = s?.status === 'failed' ? (s.error_message || 'HMRC synchronisation failed') : null
    lastSuccessfulSync = lastGood?.completed_at || null
  } catch {}

  const connectionStatus = assessHmrcConnection(connection)
  const latestError = qs.error || syncError
  const needsMatchingGrant = String(latestError || '').toLowerCase().includes('not authorised')
  const incomeSources = mergeMtdIncomeSources(businesses, obligations)
  const visibleBusinessIds = new Set(incomeSources.map(source => source.businessId))
  const sourceByBusinessId = new Map(incomeSources.map(source => [source.businessId, source]))
  const eligibleObligations = obligations.filter(o => String(o.period_start || '') >= '2025-04-06' && (visibleBusinessIds.size === 0 || visibleBusinessIds.has(String(o.business_id || '').trim())))
  const eligibleOpen = eligibleObligations.filter(o => String(o.status).toLowerCase() === 'open')
  const acceptedPending = eligibleOpen.filter(o => !!acceptedSubmissionFor(submissions, o))
  const actionableOpen = eligibleOpen.filter(o => !acceptedSubmissionFor(submissions, o))
  const eligibleYears = Array.from(new Set(eligibleObligations.map(o => taxYearFor(o.period_start)).filter(Boolean) as string[])).sort().reverse()
  const requestedYear = qs.year || 'all'
  const selectedYear = requestedYear === 'all' || eligibleYears.includes(requestedYear) ? requestedYear : 'all'
  const visibleObligations = selectedYear === 'all' ? eligibleObligations : eligibleObligations.filter(o => taxYearFor(o.period_start) === selectedYear)
  const groupedObligations = visibleObligations.reduce((map: Map<string, any[]>, obligation: any) => {
    const key = obligation.business_id || 'not-supplied'
    const rows = map.get(key) || []
    rows.push(obligation)
    map.set(key, rows)
    return map
  }, new Map<string, any[]>())
  const obligationGroups = Array.from(groupedObligations.entries()).map(([businessId, rows]) => {
    const source = sourceByBusinessId.get(businessId)
    const sourceType = source?.sourceType || obligationIncomeSourceType(businessId)
    const label = sourceType === 'self-employment' ? 'Self Assessment' : sourceType === 'uk-property' ? 'UK Property' : 'Foreign Property'
    const businessName = source?.businessName || null
    const open = rows.filter((o: any) => String(o.status || '').toLowerCase() === 'open')
    const fulfilled = rows.filter((o: any) => String(o.status || '').toLowerCase() === 'fulfilled')
    const actionable = open.filter((o: any) => !acceptedSubmissionFor(submissions, o))
    const groupNextDue = actionable.map((o: any) => o.due_date).filter(Boolean).sort()[0] || null
    return { businessId, label, businessName, sourceType, rows, total: rows.length, open: open.length, fulfilled: fulfilled.length, nextDue: groupNextDue }
  }).sort((a: any, b: any) => {
    const order: Record<string, number> = {'self-employment':0,'uk-property':1,'foreign-property':2}
    return (order[a.sourceType] ?? 10) - (order[b.sourceType] ?? 10) || String(a.businessName || a.businessId).localeCompare(String(b.businessName || b.businessId))
  })
  const sourceTypes = Array.from(new Set(incomeSources.map(source => source.sourceType).filter(Boolean))) as MtdIncomeSourceType[]
  const legacyOnly = obligations.length > 0 && eligibleObligations.length === 0
  const nextDue = actionableOpen.map(o => o.due_date).filter(Boolean).sort()[0]
  const annualYear = selectedYear === 'all' ? eligibleYears[0] : selectedYear

  return <div className="shell"><TaxpayerSidebar taxpayerId={id} active="overview" sourceTypes={sourceTypes}/><main className="main">
    <div className="top"><div><h1 className="pageTitle">{taxpayer.display_name}</h1><p className="muted">Making Tax Digital taxpayer workspace</p></div><span className={connectionStatus.badgeClass}>{connectionStatus.label}</span></div>
    <div className="cards"><div className="card"><span className="eyebrow">Connection</span><strong>{connectionStatus.usable?'Usable':'Action needed'}</strong><span className="muted">{connectionStatus.expired?'Refresh required':connectionStatus.connected?'HMRC authorisation':'Not connected'}</span></div><div className="card"><span className="eyebrow">Businesses</span><strong>{businesses.length}</strong><span className="muted">Income sources</span></div><div className="card"><span className="eyebrow">Open to submit</span><strong>{actionableOpen.length}</strong><span className="muted">{eligibleOpen.length} HMRC open across sources</span></div><div className="card"><span className="eyebrow">Accepted pending HMRC</span><strong>{acceptedPending.length}</strong><span className="muted">Awaiting obligation refresh</span></div><div className="card"><span className="eyebrow">Next due</span><strong className="dateValue">{nextDue?fmtDate(nextDue):'No eligible obligation'}</strong><span className="muted">2025/26 onward only</span></div></div>
    <div className="two"><section className="panel" id="connection"><h2>HMRC connection</h2><p className="muted">Government Gateway credentials stay with HMRC.</p><div className="detailGrid"><div><span className="eyebrow">NINO</span><strong>{taxpayer.nino||'Not saved yet'}</strong></div><div><span className="eyebrow">MTD Income Tax ID</span><strong>{taxpayer.mtditid||'Not saved yet'}</strong></div></div><div className={connectionStatus.usable?'status':'status statusError'}>{connectionStatus.detail}</div><Link className="btn" href={`/api/hmrc/oauth/start?taxpayerId=${encodeURIComponent(id)}`}>{connectionStatus.connected?'Reconnect to HMRC':'Connect to HMRC'}</Link></section><section className="panel" id="sync"><h2>Synchronise HMRC</h2><p className="muted">Refresh businesses and MTD obligations from HMRC sandbox.</p><form method="post" action="/api/hmrc/sync"><input type="hidden" name="taxpayerId" value={id}/><label>NINO</label><input className="field" name="nino" defaultValue={taxpayer.nino||''} required/><label>MTD Income Tax ID</label><input className="field" name="mtditid" defaultValue={taxpayer.mtditid||''} required/><button className="btn" type="submit">Synchronise now</button></form></section></div>
    <div className={latestError?'status statusError':'status'}>Synchronisation: {syncStatus}{lastSync?` - Latest attempt ${new Date(lastSync).toLocaleString('en-GB')}`:''}{lastSuccessfulSync&&syncStatus!=='Complete'?` - Last successful sync ${new Date(lastSuccessfulSync).toLocaleString('en-GB')}`:''}{latestError?` - ${latestError}`:''}</div>
    {needsMatchingGrant&&<div className="status statusError"><strong>HMRC token needs reconnection.</strong><div>HMRC rejected the current token for this NINO. Reconnect this taxpayer using the sandbox test user that owns NINO {taxpayer.nino||'shown above'}, then run Synchronise now again.</div><Link className="btn btnSmall" href={`/api/hmrc/oauth/start?taxpayerId=${encodeURIComponent(id)}`}>Reconnect HMRC</Link></div>}
    {acceptedPending.length>0&&<div className="status">{acceptedPending.length} quarterly update{acceptedPending.length===1?' has':'s have'} been accepted by HMRC while the obligation remains open. Synchronise HMRC to refresh the obligation status. These submissions are not counted as open to submit again.</div>}
    {legacyOnly&&<div className="status statusError"><strong>Legacy sandbox data only.</strong> HMRC returned {obligations.length} obligations from before 6 April 2025 for this test user. They are retained for connectivity diagnostics but are hidden from the modern MTD obligation selector and filing table.</div>}
    <section className="panel" style={{marginBottom:16}}><div className="sectionHead"><div><h2>HMRC business income sources</h2><p className="muted">Businesses returned by HMRC for this taxpayer.</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link className="btn btnSmall" href={`/taxpayers/${id}/businesses`}>Manage income sources</Link><Link className="btn btnSmall" href={`/taxpayers/${id}/quarterly`}>Quarterly obligations</Link></div></div><div className="tableWrap"><table><thead><tr><th>Type</th><th>Name</th><th>Business ID</th></tr></thead><tbody>{businesses.length?businesses.map(b=><tr key={b.id}><td>{b.business_type||'Self employment'}</td><td>{b.business_name||'Unnamed business'}</td><td className="mono">{b.business_id||''}</td></tr>):<tr><td colSpan={3} className="empty">No business income sources synchronised yet.</td></tr>}</tbody></table></div></section>
    <section className="panel" id="obligations"><div className="sectionHead"><div><h2>Quarterly Obligations</h2><p className="muted">Only income sources returned for this client are shown.</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><form method="post" action="/api/hmrc/sync"><input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="nino" value={taxpayer.nino||''}/><input type="hidden" name="mtditid" value={taxpayer.mtditid||''}/><button className="btn btnSmall" type="submit">Retrieve Obligations</button></form><Link className="btn btnSmall" href={`/taxpayers/${encodeURIComponent(id)}/end-of-year/adjustments${annualYear?`?taxYear=${encodeURIComponent(annualYear)}`:''}`}>Annual Adjustments</Link></div></div>
      {eligibleYears.length>0?<form method="get" className="filterForm" style={{margin:'14px 0 18px'}}><label htmlFor="year">Tax year</label><select id="year" name="year" defaultValue={selectedYear} className="selectField"><option value="all">All eligible tax years</option>{eligibleYears.map(y=><option key={y} value={y}>{y}</option>)}</select><button className="btn btnSmall" type="submit">Apply</button></form>:<div className="filterForm" style={{margin:'14px 0 18px'}}><label>Tax year</label><select className="selectField" disabled defaultValue="none"><option value="none">No eligible tax years</option></select></div>}
      <div style={{display:'grid',gap:16}}>{obligationGroups.length?obligationGroups.map((group:any)=><div key={group.businessId}><div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'end',flexWrap:'wrap',marginBottom:10}}><div><h3 style={{margin:'0 0 4px'}}>{group.label}</h3>{group.businessName&&<div className="muted">{group.businessName}</div>}<div className="mono muted">{group.businessId==='not-supplied'?'HMRC income source ID not supplied':group.businessId}</div></div><div className="muted"><strong>Next due:</strong> {group.nextDue?fmtDate(group.nextDue):'No open obligation'}</div></div><div className="tableWrap"><table><thead><tr><th>Period</th><th>Period Dates</th><th>Due Date</th><th>Submission Date & Time</th><th>Status</th><th>Action</th></tr></thead><tbody>{group.rows.map((o:any,index:number)=>{const submission=acceptedSubmissionFor(submissions,o);const st=displayStatus(o,submission);const taxYear=taxYearFor(o.period_start)||'';const query=new URLSearchParams({taxpayerId:id,businessId:group.businessId==='not-supplied'?'':group.businessId,periodStart:o.period_start||'',periodEnd:o.period_end||'',dueDate:o.due_date||'',taxYear,sourceType:group.sourceType});const available=quarterlyPeriodIsAvailable(String(o.period_end||''));const canSubmit=String(o.status||'').toLowerCase()==='open'&&!submission&&available;const canView=Boolean(submission)||String(o.status||'').toLowerCase()==='fulfilled';const actionHref=canSubmit?`/taxpayers/${encodeURIComponent(id)}/quarterly?${query.toString()}`:`/taxpayers/${encodeURIComponent(id)}/quarterly/history?${query.toString()}`;return <tr key={o.id} style={{position:'relative'}}><td>{canSubmit||canView?<Link href={actionHref} aria-label={`${canSubmit?'Submit':'View'} ${group.label} ${quarterLabel(o,index)}`} style={{position:'absolute',inset:0,zIndex:1}}/>:null}{quarterLabel(o,index)}</td><td>{fmtShortDate(o.period_start)} - {fmtShortDate(o.period_end)}</td><td>{fmtShortDate(o.due_date)}</td><td>{submissionDate(submission)}</td><td><span className={`statusPill ${st.cls}`} style={st.cls==='statusError'?{margin:0}:undefined}>{st.label}</span></td><td>{canSubmit?<Link className="btn btnSmall" href={actionHref} style={{position:'relative',zIndex:2}}>Submit</Link>:canView?<Link className="btn btnSmall" href={actionHref} style={{position:'relative',zIndex:2}}>View</Link>:<span className="muted">Available after {fmtDate(o.period_end)}</span>}</td></tr>})}{annualYear&&<tr><td><strong>{sourceAnnualLabel(group.sourceType)}</strong><div className="muted">Allowances & year-end adjustments for {annualYear}</div></td><td>-</td><td>{fmtShortDate(annualDueDate(annualYear))}</td><td>-</td><td><span className="statusPill statusOpen">{annualStatus(annualYear)}</span></td><td><Link className="btn btnSmall" href={`/taxpayers/${encodeURIComponent(id)}/end-of-year?taxYear=${encodeURIComponent(annualYear)}`}>Annual Submission</Link></td></tr>}</tbody></table></div></div>):<div className="empty">No eligible MTD obligations from 2025/26 onward are available for this taxpayer.</div>}</div>
    </section>
  </main></div>
}
