import TaxpayerSidebar from '@/app/components/TaxpayerSidebar'
import FraudContextFields from '@/app/components/FraudContextFields'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic='force-dynamic'

function taxYearFromDate(value:string){const [y,m,d]=value.split('-').map(Number);const start=m>4||(m===4&&d>=6)?y:y-1;return `${start}-${String(start+1).slice(-2)}`}
function decode(value?:string){try{return value?JSON.parse(Buffer.from(value,'base64url').toString('utf8')):null}catch{return null}}
function gbp(v:any){const n=Number(v);return Number.isFinite(n)?new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(n):'Not available'}
function findNumber(obj:any,keys:string[]):number|null{if(!obj||typeof obj!=='object')return null;for(const k of keys){if(typeof obj[k]==='number')return obj[k]}for(const v of Object.values(obj)){const n=findNumber(v,keys);if(n!==null)return n}return null}
function collectMessages(obj:any,out:string[]=[]){if(!obj||typeof obj!=='object')return out;if(Array.isArray(obj)){for(const v of obj)collectMessages(v,out);return out}for(const [k,v] of Object.entries(obj)){if((k.toLowerCase().includes('message')||k.toLowerCase().includes('warning'))&&typeof v==='string')out.push(v);else if(typeof v==='object')collectMessages(v,out)}return Array.from(new Set(out))}
function taxYearEnded(taxYear:string){const start=Number(taxYear.slice(0,4));return Number.isFinite(start)&&new Date()>=new Date(Date.UTC(start+1,3,6))}

export default async function CalculationsPage({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<Record<string,string|undefined>>}){
 const {id}=await params;const qs=await searchParams;const db=supabaseAdmin()
 const [{data:taxpayer},{data:obligations},{data:submissions}]=await Promise.all([
  db.from('taxpayers').select('display_name,nino').eq('id',id).maybeSingle(),
  db.from('hmrc_obligations').select('period_start').eq('taxpayer_id',id).gte('period_start','2025-04-06'),
  db.from('hmrc_quarterly_submissions').select('tax_year,status').eq('taxpayer_id',id).eq('status','submitted')
 ])
 const years=Array.from(new Set([...(obligations||[]).map((o:any)=>taxYearFromDate(o.period_start)),...(submissions||[]).map((s:any)=>s.tax_year).filter(Boolean)])).sort().reverse()
 const selected=qs.taxYear&&years.includes(qs.taxYear)?qs.taxYear:(years[0]||'2026-27')
 const result:any=decode(qs.result);const calculationId=qs.calculationId||result?.metadata?.calculationId||''
 const totalIncomeTax=findNumber(result,['totalIncomeTaxAndNicsDue','totalIncomeTaxDue','incomeTaxDueAfterTaxReductions','incomeTaxDue'])
 const totalTaxableIncome=findNumber(result,['totalTaxableIncome','totalIncomeReceivedFromAllSources','totalIncome'])
 const totalTaxDue=findNumber(result,['totalTaxDue','totalTaxAndNicsDue','totalIncomeTaxAndNicsDue'])
 const messages=result?collectMessages(result).slice(0,8):[]
 const ended=taxYearEnded(selected)
 return <div className="shell"><TaxpayerSidebar taxpayerId={id} active="calculations"/><main className="main">
  <div className="top"><div><h1 className="pageTitle">HMRC Tax Calculation</h1><p className="muted">Trigger and retrieve HMRC's own Self Assessment calculation after income data has been updated.</p></div><span className="badge">Individual Calculations API v8.0</span></div>
  {qs.error&&<div className="status statusError"><strong>HMRC calculation needs attention.</strong><div style={{marginTop:5}}>{qs.error}</div>{qs.correlationId&&<div className="muted">HMRC correlation ID: {qs.correlationId}</div>}</div>}
  {qs.triggered&&<div className="status"><strong>HMRC accepted the calculation request.</strong><div className="muted">The calculation is asynchronous. Wait at least 5 seconds, then retrieve it.</div>{calculationId&&<div style={{marginTop:6}}>Calculation ID: <span className="mono">{calculationId}</span></div>}</div>}
  {qs.retrieved&&<div className="status"><strong>HMRC calculation retrieved.</strong>{qs.correlationId&&<div className="muted">Correlation ID: {qs.correlationId}</div>}</div>}
  {qs.finalised&&<div className="status"><strong>HMRC accepted the Final Declaration.</strong>{qs.correlationId&&<div className="muted">Correlation ID: {qs.correlationId}</div>}</div>}
  <section className="panel"><h2>Tax calculation</h2><p className="muted">Use an in year calculation after quarterly or annual income updates. MTD Lab displays HMRC's calculation, it does not estimate the tax itself.</p>
   <div className="detailGrid"><div><span className="eyebrow">Taxpayer</span><strong>{taxpayer?.display_name||id}</strong></div><div><span className="eyebrow">NINO</span><strong>{taxpayer?.nino||'Not available'}</strong></div></div>
   <form method="post" action="/api/hmrc/calculations/trigger"><input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="calculationType" value="in-year"/><label>Tax year</label><select className="selectField" name="taxYear" defaultValue={selected}>{years.length?years.map(y=><option key={y} value={y}>{y}</option>):<option value="2026-27">2026-27</option>}</select><FraudContextFields/><button className="btn" type="submit">Trigger HMRC tax calculation</button></form>
  </section>
  <section className="panel" style={{marginTop:16}}><div className="sectionHead"><div><h2>HMRC calculation result</h2><p className="muted">Retrieve the result after HMRC has completed processing.</p></div>{calculationId&&<a className="btn btnSmall" href={`/api/hmrc/calculations/retrieve?taxpayerId=${encodeURIComponent(id)}&taxYear=${encodeURIComponent(selected)}&calculationId=${encodeURIComponent(calculationId)}`}>Retrieve calculation</a>}</div>
   {calculationId?<div className="mono" style={{marginBottom:14}}>Calculation ID: {calculationId}</div>:<p className="empty">Trigger a calculation to create an HMRC calculation ID.</p>}
   {result&&<><div className="cards"><div className="card"><span className="eyebrow">Taxable income</span><strong>{gbp(totalTaxableIncome)}</strong></div><div className="card"><span className="eyebrow">Income tax and NICs</span><strong>{gbp(totalIncomeTax)}</strong></div><div className="card"><span className="eyebrow">Total tax due</span><strong>{gbp(totalTaxDue)}</strong></div><div className="card"><span className="eyebrow">Calculation type</span><strong>{result?.metadata?.calculationType||'HMRC calculation'}</strong></div></div>{messages.length>0&&<div className="status" style={{marginTop:14}}><strong>HMRC calculation messages</strong><ul>{messages.map((m,i)=><li key={i}>{m}</li>)}</ul></div>}<details style={{marginTop:14}}><summary>View full HMRC calculation data</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(result,null,2)}</pre></details></>}
  </section>
  <section className="panel" style={{marginTop:16}}><h2>Final Declaration</h2><p className="muted">Final Declaration confirms that the taxpayer has provided their complete Self Assessment position and agrees to HMRC's tax calculation for the tax year.</p>
   {!ended?<div className="status statusError"><strong>Not available yet.</strong><div className="muted">The selected tax year has not ended, so MTD Lab will not allow Final Declaration.</div></div>:!calculationId?<div className="status statusError">Retrieve a completed HMRC calculation before Final Declaration.</div>:<form method="post" action="/api/hmrc/calculations/final-declaration"><input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="taxYear" value={selected}/><input type="hidden" name="calculationId" value={calculationId}/><FraudContextFields/><div className="status"><strong>Declaration checkpoint</strong><div className="muted">Only continue after confirming that all income sources, allowances, reliefs and other Self Assessment information for the tax year are complete.</div></div><button className="btn" type="submit">Submit Final Declaration to HMRC sandbox</button></form>}
  </section>
 </main></div>
}
