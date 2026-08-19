import TaxpayerSidebar from '@/app/components/TaxpayerSidebar'
import FraudContextFields from '@/app/components/FraudContextFields'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic='force-dynamic'

function taxYearFromDate(value:string){const [y,m,d]=value.split('-').map(Number);const start=m>4||(m===4&&d>=6)?y:y-1;return `${start}-${String(start+1).slice(-2)}`}

export default async function CalculationsPage({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<Record<string,string|undefined>>}){
 const {id}=await params;const qs=await searchParams;const db=supabaseAdmin()
 const [{data:taxpayer},{data:obligations},{data:submissions}]=await Promise.all([
  db.from('taxpayers').select('display_name,nino').eq('id',id).maybeSingle(),
  db.from('hmrc_obligations').select('period_start').eq('taxpayer_id',id).gte('period_start','2025-04-06'),
  db.from('hmrc_quarterly_submissions').select('tax_year,status').eq('taxpayer_id',id).eq('status','submitted')
 ])
 const years=Array.from(new Set([...(obligations||[]).map((o:any)=>taxYearFromDate(o.period_start)),...(submissions||[]).map((s:any)=>s.tax_year).filter(Boolean)])).sort().reverse()
 const selected=qs.taxYear&&years.includes(qs.taxYear)?qs.taxYear:(years[0]||'2026-27')
 return <div className="shell"><TaxpayerSidebar taxpayerId={id} active="calculations"/><main className="main">
  <div className="top"><div><h1 className="pageTitle">HMRC Tax Calculation</h1><p className="muted">Trigger HMRC's own Self Assessment calculation after income data has been updated.</p></div><span className="badge">Individual Calculations API v8.0</span></div>
  {qs.error&&<div className="status statusError"><strong>Calculation request needs attention.</strong><div style={{marginTop:5}}>{qs.error}</div>{qs.correlationId&&<div className="muted">HMRC correlation ID: {qs.correlationId}</div>}</div>}
  {qs.triggered&&<div className="status"><strong>HMRC accepted the calculation request.</strong><div className="muted">The calculation is asynchronous. HMRC recommends waiting at least 5 seconds before retrieving the result.</div>{qs.calculationId&&<div style={{marginTop:6}}>Calculation ID: <span className="mono">{qs.calculationId}</span></div>}</div>}
  <section className="panel"><h2>Trigger in year tax calculation</h2><p className="muted">Use this after a quarterly or annual income update. It asks HMRC to calculate the taxpayer's current Self Assessment position, it does not submit a final declaration.</p>
   <div className="detailGrid"><div><span className="eyebrow">Taxpayer</span><strong>{taxpayer?.display_name||id}</strong></div><div><span className="eyebrow">NINO</span><strong>{taxpayer?.nino||'Not available'}</strong></div></div>
   <form method="post" action="/api/hmrc/calculations/trigger"><input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="calculationType" value="in-year"/><label>Tax year</label><select className="selectField" name="taxYear" defaultValue={selected}>{years.length?years.map(y=><option key={y} value={y}>{y}</option>):<option value="2026-27">2026-27</option>}</select><FraudContextFields/><button className="btn" type="submit">Trigger HMRC tax calculation</button></form>
  </section>
  <section className="panel" style={{marginTop:16}}><h2>Calculation result</h2>{qs.calculationId?<><p>Calculation request ID</p><div className="mono">{qs.calculationId}</div><p className="muted" style={{marginTop:12}}>The next build step will retrieve and display the full HMRC calculation result against this ID, including liability totals and calculation messages.</p></>:<p className="empty">Trigger a calculation to create an HMRC calculation ID.</p>}</section>
 </main></div>
}
