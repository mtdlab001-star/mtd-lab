import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

function fmtDate(value?: string | null) {
  if (!value) return 'Not available'
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function eligibleForCumulative(value?:string|null){
  if(!value) return false
  return value >= '2025-04-06'
}

export default async function QuarterlyPage({ params, searchParams }: { params: Promise<{id:string}>, searchParams: Promise<Record<string,string|undefined>> }) {
  const { id } = await params
  const qs = await searchParams
  const db = supabaseAdmin()
  const [{data: taxpayer},{data: businesses},{data: obligations}] = await Promise.all([
    db.from('taxpayers').select('*').eq('id',id).maybeSingle(),
    db.from('hmrc_businesses').select('*').eq('taxpayer_id',id).order('created_at'),
    db.from('hmrc_obligations').select('*').eq('taxpayer_id',id).order('due_date',{ascending:true})
  ])
  const open=(obligations||[]).filter((o:any)=>String(o.status).toLowerCase()==='open')
  const eligible=open.filter((o:any)=>eligibleForCumulative(o.period_start))
  const selectedBusiness=qs.businessId || businesses?.[0]?.business_id || ''
  const selectedObligation=eligible.find((o:any)=>!o.business_id || o.business_id===selectedBusiness) || eligible[0]

  return <div className="shell"><aside className="side"><div className="brand">MTD Lab</div><div className="nav"><Link href="/">Dashboard</Link><Link href="/taxpayers">Taxpayers</Link><Link href={`/taxpayers/${id}`}>Taxpayer workspace</Link><span>Quarterly Updates</span></div><div className="operator">Operated by Glomaxel IT Service</div></aside><main className="main"><div className="top"><div><h1 className="pageTitle">Quarterly update</h1><p className="muted">Prepare cumulative self employment income and expenses for HMRC MTD.</p></div><span className="badge">Sandbox</span></div>
  <section className="panel" style={{marginBottom:16}}><h2>{taxpayer?.display_name||'Taxpayer'}</h2><form method="get" className="filterForm"><label htmlFor="businessId">Business</label><select className="selectField" id="businessId" name="businessId" defaultValue={selectedBusiness}>{(businesses||[]).map((b:any)=><option key={b.id} value={b.business_id}>{b.business_name||b.business_id}</option>)}</select><button className="btn btnSmall" type="submit">Select</button></form>{selectedObligation&&<div className="status">Open cumulative period: {fmtDate(selectedObligation.period_start)} to {fmtDate(selectedObligation.period_end)}, due {fmtDate(selectedObligation.due_date)}</div>}{!selectedObligation&&<div className="status statusError">No eligible cumulative obligation is available. HMRC cumulative quarterly updates apply from tax year 2025/26 onward. Use sandbox test data with an open obligation starting on or after 6 April 2025.</div>}</section>
  <section className="panel"><div className="sectionHead"><div><h2>Prepare cumulative totals</h2><p className="muted">Enter cumulative totals from the start of the tax year to the end of this update period. Review the figures before any HMRC transmission.</p></div></div><form method="post" action="/api/hmrc/quarterly/prepare"><input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="businessId" value={selectedBusiness}/><input type="hidden" name="periodStart" value={selectedObligation?.period_start||''}/><input type="hidden" name="periodEnd" value={selectedObligation?.period_end||''}/><div className="two"><div><label>Turnover / income (£)</label><input className="field" name="turnover" type="number" min="0" step="0.01" required disabled={!selectedObligation}/></div><div><label>Other business income (£)</label><input className="field" name="otherIncome" type="number" min="0" step="0.01" defaultValue="0" disabled={!selectedObligation}/></div></div><h3>Allowable expenses</h3><div className="two"><div><label>Cost of goods (£)</label><input className="field" name="costOfGoods" type="number" min="0" step="0.01" defaultValue="0" disabled={!selectedObligation}/><label>Staff costs (£)</label><input className="field" name="staffCosts" type="number" min="0" step="0.01" defaultValue="0" disabled={!selectedObligation}/><label>Travel costs (£)</label><input className="field" name="travelCosts" type="number" min="0" step="0.01" defaultValue="0" disabled={!selectedObligation}/></div><div><label>Premises costs (£)</label><input className="field" name="premisesCosts" type="number" min="0" step="0.01" defaultValue="0" disabled={!selectedObligation}/><label>Professional fees (£)</label><input className="field" name="professionalFees" type="number" min="0" step="0.01" defaultValue="0" disabled={!selectedObligation}/><label>Other expenses (£)</label><input className="field" name="otherExpenses" type="number" min="0" step="0.01" defaultValue="0" disabled={!selectedObligation}/></div></div><button className="btn" type="submit" disabled={!selectedBusiness||!selectedObligation}>Review quarterly update</button></form></section></main></div>
}
