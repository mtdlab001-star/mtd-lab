import Link from 'next/link'
import TaxpayerSidebar from '@/app/components/TaxpayerSidebar'
import FraudContextFields from '@/app/components/FraudContextFields'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic='force-dynamic'

function isProperty(b:any){const t=String(b.business_type||'').toLowerCase();const r=JSON.stringify(b.raw||{}).toLowerCase();return t.includes('property')||r.includes('uk-property')||r.includes('property')}
function decode(value?:string){try{return value?JSON.parse(Buffer.from(value,'base64url').toString('utf8')):null}catch{return null}}
function gbp(v:any){return new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Number(v||0))}

export default async function AdjustmentsPage({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<Record<string,string|undefined>>}){
 const {id}=await params;const qs=await searchParams;const db=supabaseAdmin()
 const [{data:taxpayer},{data:businesses},{data:obligations}]=await Promise.all([
  db.from('taxpayers').select('display_name,nino').eq('id',id).maybeSingle(),
  db.from('hmrc_businesses').select('*').eq('taxpayer_id',id).order('created_at'),
  db.from('hmrc_obligations').select('period_start').eq('taxpayer_id',id).gte('period_start','2025-04-06')
 ])
 const years=Array.from(new Set((obligations||[]).map((o:any)=>{const d=String(o.period_start);const y=Number(d.slice(0,4));return `${y}-${String(y+1).slice(-2)}`}))).sort().reverse()
 const selected=qs.taxYear&&years.includes(qs.taxYear)?qs.taxYear:(years[0]||'2026-27')
 const lossResult:any=decode(qs.lossResult)
 return <div className="shell"><TaxpayerSidebar taxpayerId={id} active="adjustments"/><main className="main">
  <div className="top"><div><h1 className="pageTitle">Annual Adjustments and Losses</h1><p className="muted">Prepare year end business adjustments and review HMRC losses before intent to finalise.</p></div><span className="badge">{selected}</span></div>
  {qs.error&&<div className="status statusError"><strong>HMRC needs attention.</strong><div>{qs.error}</div>{qs.correlationId&&<div className="muted">Correlation ID: {qs.correlationId}</div>}</div>}
  {qs.bsasTriggered&&<div className="status"><strong>HMRC generated a Business Source Adjustable Summary.</strong>{qs.calculationId&&<div>BSAS calculation ID: <span className="mono">{qs.calculationId}</span></div>}<div className="muted">This summary is the starting point for entering accounting adjustments for the selected business.</div></div>}
  <section className="panel"><div className="sectionHead"><div><h2>Business Source Adjustable Summary</h2><p className="muted">Generate one summary for each business that needs year end accounting adjustments.</p></div><form method="get"><select className="selectField" name="taxYear" defaultValue={selected}>{years.map(y=><option key={y} value={y}>{y}</option>)}</select><button className="btn btnSmall" type="submit">Change year</button></form></div>
   <div className="tableWrap"><table><thead><tr><th>Income source</th><th>Business</th><th>Business ID</th><th>Year end adjustment</th></tr></thead><tbody>{(businesses||[]).length?(businesses||[]).map((b:any)=>{const property=isProperty(b);return <tr key={b.id}><td>{property?'UK Property':'Self Employment'}</td><td>{b.business_name||'HMRC business'}</td><td className="mono">{b.business_id}</td><td><form method="post" action="/api/hmrc/bsas/trigger"><input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="taxYear" value={selected}/><input type="hidden" name="businessId" value={b.business_id}/><input type="hidden" name="typeOfBusiness" value={property?'uk-property':'self-employment'}/><FraudContextFields/><button className="btn btnSmall" type="submit">Generate adjustable summary</button></form></td></tr>}):<tr><td colSpan={4} className="empty">No HMRC businesses are available.</td></tr>}</tbody></table></div>
  </section>
  <section className="panel" style={{marginTop:16}}><h2>Losses and claims</h2><p className="muted">Retrieve brought forward losses and current loss claims directly from HMRC for each business.</p>
   <div className="tableWrap"><table><thead><tr><th>Business</th><th>Income source</th><th>Action</th></tr></thead><tbody>{(businesses||[]).map((b:any)=><tr key={b.id}><td>{b.business_name||b.business_id}</td><td>{isProperty(b)?'UK Property':'Self Employment'}</td><td><form method="post" action="/api/hmrc/losses/retrieve"><input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="taxYear" value={selected}/><input type="hidden" name="businessId" value={b.business_id}/><FraudContextFields/><button className="btn btnSmall" type="submit">Retrieve losses and claims</button></form></td></tr>)}</tbody></table></div>
   {qs.lossesRetrieved&&lossResult&&<div style={{marginTop:18}}><h3>HMRC losses and claims</h3><div className="cards"><div className="card"><span className="eyebrow">Brought forward losses</span><strong>{gbp(lossResult?.losses?.broughtForwardLosses)}</strong></div><div className="card"><span className="eyebrow">Current year loss carried forward</span><strong>{gbp(lossResult?.claims?.carryForward?.currentYearLosses)}</strong></div><div className="card"><span className="eyebrow">Previous years losses carried forward</span><strong>{gbp(lossResult?.claims?.carryForward?.previousYearsLosses)}</strong></div><div className="card"><span className="eyebrow">Current year general income claim</span><strong>{gbp(lossResult?.claims?.carrySideways?.currentYearGeneralIncome)}</strong></div></div><details style={{marginTop:12}}><summary>View full HMRC loss response</summary><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(lossResult,null,2)}</pre></details></div>}
  </section>
  <div style={{marginTop:16,display:'flex',gap:8,flexWrap:'wrap'}}><Link className="btn btnSmall" href={`/taxpayers/${id}/end-of-year?taxYear=${encodeURIComponent(selected)}`}>Back to End of Year</Link><Link className="btn btnSmall" href={`/taxpayers/${id}/calculations?taxYear=${encodeURIComponent(selected)}`}>HMRC Tax Calculation</Link></div>
 </main></div>
}
