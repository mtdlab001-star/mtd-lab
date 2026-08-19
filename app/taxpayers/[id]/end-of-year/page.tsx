import Link from 'next/link'
import TaxpayerSidebar from '@/app/components/TaxpayerSidebar'
import FraudContextFields from '@/app/components/FraudContextFields'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic='force-dynamic'

function taxYearFromDate(value:string){const [y,m,d]=value.split('-').map(Number);const start=m>4||(m===4&&d>=6)?y:y-1;return `${start}-${String(start+1).slice(-2)}`}
function taxYearEnd(taxYear:string){const start=Number(taxYear.slice(0,4));return new Date(`${start+1}-04-05T23:59:59Z`)}
function isProperty(b:any){const t=String(b.business_type||'').toLowerCase();const r=JSON.stringify(b.raw||{}).toLowerCase();return t.includes('property')||r.includes('property')}

export default async function EndOfYearPage({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<Record<string,string|undefined>>}){
 const {id}=await params;const qs=await searchParams;const db=supabaseAdmin()
 const [{data:taxpayer},{data:businesses},{data:obligations},{data:submissions}]=await Promise.all([
  db.from('taxpayers').select('display_name,nino').eq('id',id).maybeSingle(),
  db.from('hmrc_businesses').select('*').eq('taxpayer_id',id),
  db.from('hmrc_obligations').select('*').eq('taxpayer_id',id).gte('period_start','2025-04-06'),
  db.from('hmrc_quarterly_submissions').select('*').eq('taxpayer_id',id)
 ])
 const years=Array.from(new Set((obligations||[]).map((o:any)=>taxYearFromDate(o.period_start)))).sort().reverse()
 const selected=qs.taxYear&&years.includes(qs.taxYear)?qs.taxYear:(years[0]||'2026-27')
 const yearObligations=(obligations||[]).filter((o:any)=>taxYearFromDate(o.period_start)===selected)
 const open=yearObligations.filter((o:any)=>String(o.status).toLowerCase()==='open')
 const accepted=(submissions||[]).filter((s:any)=>s.tax_year===selected&&s.status==='submitted')
 const businessCount=(businesses||[]).length
 const hasProperty=(businesses||[]).some(isProperty)
 const ended=new Date()>taxYearEnd(selected)
 const quarterlyReady=yearObligations.length>0&&open.length===0
 const incomeSourcesReady=businessCount>0
 const acceptedReady=accepted.length>0
 const canFinalise=ended&&incomeSourcesReady&&quarterlyReady
 const blockers=[!ended?'Tax year has not ended':null,!incomeSourcesReady?'No HMRC income sources found':null,!quarterlyReady?'Open quarterly obligations remain':null].filter(Boolean)
 return <div className="shell"><TaxpayerSidebar taxpayerId={id} active="end-of-year"/><main className="main">
  <div className="top"><div><h1 className="pageTitle">End of Year</h1><p className="muted">Review MTD readiness before requesting HMRC's intent to finalise calculation and, when permitted, completing the Final Declaration.</p></div><span className="badge">{selected}</span></div>
  {qs.error&&<div className="status statusError"><strong>HMRC needs attention.</strong><div>{qs.error}</div>{qs.correlationId&&<div className="muted">Correlation ID: {qs.correlationId}</div>}</div>}
  {qs.triggered&&<div className="status"><strong>Intent to finalise calculation requested.</strong>{qs.calculationId&&<div>Calculation ID: <span className="mono">{qs.calculationId}</span></div>}<div className="muted">Retrieve the calculation from HMRC before proceeding to any Final Declaration.</div></div>}
  <section className="panel"><div className="sectionHead"><div><h2>Year end readiness</h2><p className="muted">MTD Lab uses HMRC data and the application's submission audit trail to show what is complete and what still needs attention.</p></div><form method="get"><select className="selectField" name="taxYear" defaultValue={selected}>{years.length?years.map(y=><option key={y} value={y}>{y}</option>):<option value={selected}>{selected}</option>}</select><button className="btn btnSmall" type="submit">View tax year</button></form></div>
   <div className="cards"><div className="card"><span className="eyebrow">Income sources</span><strong>{incomeSourcesReady?'Ready':'Needs attention'}</strong><p className="muted">{businessCount} HMRC income source{businessCount===1?'':'s'} found{hasProperty?', including UK property':''}.</p></div><div className="card"><span className="eyebrow">Quarterly obligations</span><strong>{quarterlyReady?'Complete':`${open.length} open`}</strong><p className="muted">{yearObligations.length} modern obligation{yearObligations.length===1?'':'s'} retrieved for {selected}.</p></div><div className="card"><span className="eyebrow">Accepted updates</span><strong>{accepted.length}</strong><p className="muted">Accepted cumulative quarterly submissions recorded by MTD Lab for this tax year.</p></div><div className="card"><span className="eyebrow">Finalisation gate</span><strong>{canFinalise?'Ready':'Blocked'}</strong><p className="muted">{canFinalise?'Core year end conditions are satisfied.':blockers.join('. ')||'Review required.'}</p></div></div>
  </section>
  <section className="panel" style={{marginTop:16}}><h2>Completion checklist</h2><div className="tableWrap"><table><thead><tr><th>Step</th><th>Status</th><th>Action</th></tr></thead><tbody>
   <tr><td>HMRC income sources retrieved</td><td><span className={`statusPill ${incomeSourcesReady?'statusDone':'statusOpen'}`}>{incomeSourcesReady?'Ready':'Action needed'}</span></td><td><Link className="btn btnSmall" href={`/taxpayers/${id}/businesses`}>Review businesses</Link></td></tr>
   <tr><td>Quarterly obligations completed</td><td><span className={`statusPill ${quarterlyReady?'statusDone':'statusOpen'}`}>{quarterlyReady?'Complete':'Open periods remain'}</span></td><td><Link className="btn btnSmall" href={`/taxpayers/${id}/quarterly`}>Review obligations</Link></td></tr>
   <tr><td>Quarterly figures accepted by HMRC</td><td><span className={`statusPill ${acceptedReady?'statusDone':'statusOpen'}`}>{acceptedReady?'Submission activity found':'No accepted update recorded'}</span></td><td><Link className="btn btnSmall" href={`/taxpayers/${id}/quarterly/history`}>View history</Link></td></tr>
   <tr><td>Annual adjustments and losses</td><td><span className="statusPill statusOpen">Review required</span></td><td><Link className="btn btnSmall" href={`/taxpayers/${id}/end-of-year/adjustments?taxYear=${encodeURIComponent(selected)}`}>Open adjustments and losses</Link></td></tr>
   <tr><td>Tax liability adjustments</td><td><span className="statusPill statusOpen">Review if applicable</span></td><td><Link className="btn btnSmall" href={`/taxpayers/${id}/end-of-year/tax-liability?taxYear=${encodeURIComponent(selected)}`}>Open tax liability adjustments</Link></td></tr>
   <tr><td>Reliefs and deductions</td><td><span className="statusPill statusOpen">Review if applicable</span></td><td><Link className="btn btnSmall" href={`/taxpayers/${id}/end-of-year/reliefs?taxYear=${encodeURIComponent(selected)}`}>Review HMRC reliefs</Link></td></tr>
   <tr><td>Other Self Assessment income</td><td><span className="statusPill statusOpen">Review if applicable</span></td><td><Link className="btn btnSmall" href={`/taxpayers/${id}/end-of-year/other-income?taxYear=${encodeURIComponent(selected)}`}>Review other income</Link></td></tr>
   <tr><td>State benefits</td><td><span className="statusPill statusOpen">Review if applicable</span></td><td><Link className="btn btnSmall" href={`/taxpayers/${id}/end-of-year/state-benefits?taxYear=${encodeURIComponent(selected)}`}>Review state benefits</Link></td></tr>
   <tr><td>HMRC tax calculation</td><td><span className="statusPill statusOpen">Required</span></td><td><Link className="btn btnSmall" href={`/taxpayers/${id}/calculations?taxYear=${encodeURIComponent(selected)}`}>Open calculations</Link></td></tr>
  </tbody></table></div></section>
  <section className="panel" style={{marginTop:16}}><h2>Intent to finalise</h2><p className="muted">This asks HMRC to generate the calculation used for the end of year journey. It does not itself make the Final Declaration.</p>{!canFinalise&&<div className="status statusError"><strong>Intent to finalise is currently blocked.</strong><div className="muted">{blockers.join('. ')}.</div></div>}<form method="post" action="/api/hmrc/calculations/trigger"><input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="taxYear" value={selected}/><input type="hidden" name="calculationType" value="intent-to-finalise"/><FraudContextFields/><button className="btn" type="submit" disabled={!canFinalise}>Request intent to finalise calculation</button></form><div style={{marginTop:12}}><Link className="btn btnSmall" href={`/taxpayers/${id}/calculations?taxYear=${encodeURIComponent(selected)}`}>HMRC Tax Calculation</Link></div></section>
 </main></div>
}
