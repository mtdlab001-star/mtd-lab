import Link from 'next/link'
import TaxpayerSidebar from '@/app/components/TaxpayerSidebar'
import FraudContextFields from '@/app/components/FraudContextFields'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { latestHmrcResponse } from '@/lib/hmrc-response-audit'

export const dynamic='force-dynamic'
function gbp(v:any){return new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Number(v||0))}
function ended(taxYear:string){const y=Number(taxYear.slice(0,4));return new Date()>new Date(`${y+1}-04-05T23:59:59Z`)}
const money=(name:string,label:string)=><label>{label}<input className="inputField" name={name} inputMode="decimal" placeholder="0.00"/></label>

export default async function TaxLiabilityPage({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<Record<string,string|undefined>>}){
 const {id}=await params;const qs=await searchParams;const db=supabaseAdmin();const {data:obligations}=await db.from('hmrc_obligations').select('period_start').eq('taxpayer_id',id).gte('period_start','2025-04-06')
 const years=Array.from(new Set((obligations||[]).map((o:any)=>{const y=Number(String(o.period_start).slice(0,4));return `${y}-${String(y+1).slice(-2)}`}))).sort().reverse();const selected=qs.taxYear&&years.includes(qs.taxYear)?qs.taxYear:(years[0]||'2026-27');const stored=await latestHmrcResponse(db,{taxpayerId:id,taxYear:selected,eventType:'tax_liability_retrieval'});const result:any=stored?.response_summary||stored?.response_payload||null;const yearEnded=ended(selected)
 return <div className="shell"><TaxpayerSidebar taxpayerId={id} active="tax-liability"/><main className="main">
  <div className="top"><div><h1 className="pageTitle">Tax Liability Adjustments</h1><p className="muted">Retrieve, create or amend HMRC tax liability adjustments before final declaration.</p></div><span className="badge">{selected}</span></div>
  {qs.error&&<div className="status statusError"><strong>HMRC needs attention.</strong><div>{qs.error}</div>{qs.correlationId&&<div className="muted">Correlation ID: {qs.correlationId}</div>}</div>}
  {qs.saved&&<div className="status"><strong>Tax liability adjustments accepted by HMRC.</strong>{qs.correlationId&&<div className="muted">Correlation ID: {qs.correlationId}</div>}</div>}
  <section className="panel"><div className="sectionHead"><div><h2>HMRC adjustments for this tax year</h2><p className="muted">Retrieve any existing adjustment before creating or changing figures.</p></div><form method="get"><select className="selectField" name="taxYear" defaultValue={selected}>{years.length?years.map(y=><option key={y} value={y}>{y}</option>):<option value={selected}>{selected}</option>}</select><button className="btn btnSmall" type="submit">Change year</button></form></div>
   <form method="get" action="/api/hmrc/tax-liability/retrieve"><input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="taxYear" value={selected}/><button className="btn btnSmall" type="submit">Retrieve from HMRC</button></form>
   {qs.retrieved&&result&&<div style={{marginTop:18}}><div className="cards"><div className="card"><span className="eyebrow">Income Tax decrease</span><strong>{gbp(result?.carryBackLossesDecrease?.incomeTax)}</strong></div><div className="card"><span className="eyebrow">Class 4 decrease</span><strong>{gbp(result?.carryBackLossesDecrease?.class4)}</strong></div><div className="card"><span className="eyebrow">Capital Gains Tax decrease</span><strong>{gbp(result?.carryBackLossesDecrease?.capitalGainsTax)}</strong></div><div className="card"><span className="eyebrow">Tax refunded or set off</span><strong>{gbp(result?.taxRefundedOrSetOff?.amount)}</strong></div></div><details style={{marginTop:12}}><summary>View full HMRC response</summary><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(result,null,2)}</pre></details></div>}
  </section>
  <section className="panel" style={{marginTop:16}}><h2>Create or amend tax liability adjustments</h2><p className="muted">Use this after the related carry back loss claims have been recorded. HMRC requires this endpoint to be used after the tax year has ended.</p>
   {!yearEnded&&<div className="status statusError"><strong>Tax year still in progress.</strong><div className="muted">Production submission is guarded until the tax year has ended. The sandbox can still be used for development testing.</div></div>}
   <form method="post" action="/api/hmrc/tax-liability/amend"><input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="taxYear" value={selected}/><h3>Carry back losses decrease</h3><div className="formGrid">{money('incomeTax','Income Tax decrease')}{money('class4','Class 4 NIC decrease')}{money('capitalGainsTax','Capital Gains Tax decrease')}</div><h3>Tax refunded or set off</h3><div className="formGrid">{money('taxRefundedOrSetOff','Amount already refunded or set off')}</div><FraudContextFields/><button className="btn" type="submit">Submit tax liability adjustments to HMRC</button></form>
  </section>
  <div style={{marginTop:16,display:'flex',gap:8,flexWrap:'wrap'}}><Link className="btn btnSmall" href={`/taxpayers/${id}/end-of-year?taxYear=${encodeURIComponent(selected)}`}>Back to End of Year</Link><Link className="btn btnSmall" href={`/taxpayers/${id}/end-of-year/adjustments?taxYear=${encodeURIComponent(selected)}`}>Annual Adjustments and Losses</Link><Link className="btn btnSmall" href={`/taxpayers/${id}/calculations?taxYear=${encodeURIComponent(selected)}`}>HMRC Tax Calculation</Link></div>
 </main></div>
}
