import Link from 'next/link'
import TaxpayerSidebar from '@/app/components/TaxpayerSidebar'
import FraudContextFields from '@/app/components/FraudContextFields'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { YEAR_END_REVIEW_SECTIONS, taxYearFromDate, yearEndFinalisationStatus } from '@/lib/year-end-finalisation'

export const dynamic='force-dynamic'

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
 const {data:reviews}=await db.from('mtd_year_end_reviews').select('section,status,note,reviewed_at').eq('taxpayer_id',id).eq('tax_year',selected)
 const reviewMap=new Map((reviews||[]).map((r:any)=>[r.section,r]))
 const accepted=(submissions||[]).filter((s:any)=>s.tax_year===selected&&s.status==='submitted')
 const businessCount=(businesses||[]).length
 const hasProperty=(businesses||[]).some(isProperty)
 const acceptedReady=accepted.length>0
 const tracked=[...YEAR_END_REVIEW_SECTIONS]
 const readiness=yearEndFinalisationStatus({taxYear:selected,businessCount,obligations:obligations||[],reviews:reviews||[]})
 const {canFinalise,blockers,incomeSourcesReady,quarterlyReady,reviewComplete,yearObligationCount,openCount,completedReviewCount}=readiness
 const statusInfo=(section:string)=>{const r:any=reviewMap.get(section);if(!r)return {label:'Not reviewed',cls:'statusOpen'};if(r.status==='reviewed')return {label:'Reviewed',cls:'statusDone'};if(r.status==='not_applicable')return {label:'Not applicable',cls:'statusDone'};return {label:'Action required',cls:'statusOpen'}}
 const reviewButtons=(section:string)=><form method="post" action="/api/year-end/review" style={{display:'flex',gap:6,flexWrap:'wrap'}}><input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="taxYear" value={selected}/><input type="hidden" name="section" value={section}/><button className="btn btnSmall" name="status" value="reviewed" type="submit">Mark reviewed</button><button className="btn btnSmall" name="status" value="not_applicable" type="submit">Not applicable</button><button className="btn btnSmall" name="status" value="action_required" type="submit">Needs action</button></form>
 return <div className="shell"><TaxpayerSidebar taxpayerId={id} active="end-of-year"/><main className="main">
  <div className="top"><div><h1 className="pageTitle">End of Year</h1><p className="muted">Review MTD readiness before requesting HMRC's intent to finalise calculation and, when permitted, completing the Final Declaration.</p></div><span className="badge">{selected}</span></div>
  {qs.error&&<div className="status statusError"><strong>HMRC needs attention.</strong><div>{qs.error}</div>{qs.correlationId&&<div className="muted">Correlation ID: {qs.correlationId}</div>}</div>}
  {qs.reviewError&&<div className="status statusError"><strong>Review status was not saved.</strong><div>{qs.reviewError}</div></div>}
  {qs.reviewSaved&&<div className="status"><strong>Year end review status updated.</strong><div className="muted">Section: {qs.reviewSaved}</div></div>}
  {qs.triggered&&<div className="status"><strong>Intent to finalise calculation requested.</strong>{qs.calculationId&&<div>Calculation ID: <span className="mono">{qs.calculationId}</span></div>}<div className="muted">Retrieve the calculation from HMRC before proceeding to any Final Declaration.</div></div>}
  <section className="panel"><div className="sectionHead"><div><h2>Year end readiness</h2><p className="muted">MTD Lab combines HMRC data, submission history and explicit year end review status so finalisation cannot bypass unreviewed schedules.</p></div><form method="get"><select className="selectField" name="taxYear" defaultValue={selected}>{years.length?years.map(y=><option key={y} value={y}>{y}</option>):<option value={selected}>{selected}</option>}</select><button className="btn btnSmall" type="submit">View tax year</button></form></div>
   <div className="cards"><div className="card"><span className="eyebrow">Income sources</span><strong>{incomeSourcesReady?'Ready':'Needs attention'}</strong><p className="muted">{businessCount} HMRC income source{businessCount===1?'':'s'} found{hasProperty?', including UK property':''}.</p></div><div className="card"><span className="eyebrow">Quarterly obligations</span><strong>{quarterlyReady?'Complete':`${openCount} open`}</strong><p className="muted">{yearObligationCount} modern obligation{yearObligationCount===1?'':'s'} retrieved for {selected}.</p></div><div className="card"><span className="eyebrow">Year end schedules</span><strong>{reviewComplete?'Reviewed':'Incomplete'}</strong><p className="muted">{completedReviewCount} of {tracked.length} controlled schedules completed.</p></div><div className="card"><span className="eyebrow">Finalisation gate</span><strong>{canFinalise?'Ready':'Blocked'}</strong><p className="muted">{canFinalise?'Core year end conditions are satisfied.':blockers.join('. ')||'Review required.'}</p></div></div>
  </section>
  <section className="panel" style={{marginTop:16}}><h2>Completion checklist</h2><div className="tableWrap"><table><thead><tr><th>Step</th><th>Status</th><th>Open schedule</th><th>Review control</th></tr></thead><tbody>
   <tr><td>HMRC income sources retrieved</td><td><span className={`statusPill ${incomeSourcesReady?'statusDone':'statusOpen'}`}>{incomeSourcesReady?'Ready':'Action needed'}</span></td><td><Link className="btn btnSmall" href={`/taxpayers/${id}/businesses`}>Review businesses</Link></td><td>HMRC driven</td></tr>
   <tr><td>Quarterly obligations completed</td><td><span className={`statusPill ${quarterlyReady?'statusDone':'statusOpen'}`}>{quarterlyReady?'Complete':'Open periods remain'}</span></td><td><Link className="btn btnSmall" href={`/taxpayers/${id}/quarterly`}>Review obligations</Link></td><td>HMRC driven</td></tr>
   <tr><td>Quarterly figures accepted by HMRC</td><td><span className={`statusPill ${acceptedReady?'statusDone':'statusOpen'}`}>{acceptedReady?'Submission activity found':'No accepted update recorded'}</span></td><td><Link className="btn btnSmall" href={`/taxpayers/${id}/quarterly/history`}>View history</Link></td><td>Audit trail</td></tr>
   {([['adjustments','Annual adjustments and losses',`/taxpayers/${id}/end-of-year/adjustments?taxYear=${encodeURIComponent(selected)}`],['tax-liability','Tax liability adjustments',`/taxpayers/${id}/end-of-year/tax-liability?taxYear=${encodeURIComponent(selected)}`],['reliefs','Reliefs and deductions',`/taxpayers/${id}/end-of-year/reliefs?taxYear=${encodeURIComponent(selected)}`],['other-income','Other Self Assessment income',`/taxpayers/${id}/end-of-year/other-income?taxYear=${encodeURIComponent(selected)}`],['state-benefits','State benefits',`/taxpayers/${id}/end-of-year/state-benefits?taxYear=${encodeURIComponent(selected)}`],['employment','Employment and occupational pensions',`/taxpayers/${id}/end-of-year/employment?taxYear=${encodeURIComponent(selected)}`]] as string[][]).map(([key,label,href])=>{const s=statusInfo(key);return <tr key={key}><td>{label}</td><td><span className={`statusPill ${s.cls}`}>{s.label}</span></td><td><Link className="btn btnSmall" href={href}>Open</Link></td><td>{reviewButtons(key)}</td></tr>})}
   <tr><td>HMRC tax calculation</td><td><span className="statusPill statusOpen">Required</span></td><td><Link className="btn btnSmall" href={`/taxpayers/${id}/calculations?taxYear=${encodeURIComponent(selected)}`}>Open calculations</Link></td><td>HMRC driven</td></tr>
  </tbody></table></div></section>
  <section className="panel" style={{marginTop:16}}><h2>Intent to finalise</h2><p className="muted">This asks HMRC to generate the calculation used for the end of year journey. It does not itself make the Final Declaration.</p>{!canFinalise&&<div className="status statusError"><strong>Intent to finalise is currently blocked.</strong><div className="muted">{blockers.join('. ')}.</div></div>}<form method="post" action="/api/hmrc/calculations/trigger"><input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="taxYear" value={selected}/><input type="hidden" name="calculationType" value="intent-to-finalise"/><FraudContextFields/><button className="btn" type="submit" disabled={!canFinalise}>Request intent to finalise calculation</button></form><div style={{marginTop:12}}><Link className="btn btnSmall" href={`/taxpayers/${id}/calculations?taxYear=${encodeURIComponent(selected)}`}>HMRC Tax Calculation</Link></div></section>
 </main></div>
}
