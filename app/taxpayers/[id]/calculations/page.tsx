import { redirect } from 'next/navigation'
import TaxpayerSidebar from '@/app/components/TaxpayerSidebar'
import FraudContextFields from '@/app/components/FraudContextFields'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { taxYearFromDate, yearEndFinalisationStatus } from '@/lib/year-end-finalisation'
import { currentWorkspace } from '@/lib/workspace'

export const dynamic='force-dynamic'

function isHmrcSandboxPlaceholder(n:number){return Math.abs(n)>=99999999999||n===5000.99}
function gbp(v:any){const n=Number(v);return Number.isFinite(n)?(isHmrcSandboxPlaceholder(n)?'Sandbox test value':new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(n)):'Not available'}
function findNumber(obj:any,keys:string[]):number|null{if(!obj||typeof obj!=='object')return null;for(const k of keys){if(typeof obj[k]==='number')return obj[k]}for(const v of Object.values(obj)){const n=findNumber(v,keys);if(n!==null)return n}return null}
function collectMessages(obj:any,out:string[]=[]){if(!obj||typeof obj!=='object')return out;if(Array.isArray(obj)){for(const v of obj)collectMessages(v,out);return out}for(const [k,v] of Object.entries(obj)){if((k.toLowerCase().includes('message')||k.toLowerCase().includes('warning'))&&typeof v==='string')out.push(v);else if(typeof v==='object')collectMessages(v,out)}return Array.from(new Set(out))}
function agentLabel(r:any){return `${r.mtd_agents?.agent_name||'Authorised agent'}${r.mtd_agents?.organisation_name?` · ${r.mtd_agents.organisation_name}`:''}${r.mtd_agents?.hmrc_arn?` · ARN ${r.mtd_agents.hmrc_arn}`:''}`}
function sandboxSignal(obj:any){const text=JSON.stringify(obj||{});return /5000\.99|-99999999999\.99|"string"/.test(text)}

export default async function CalculationsPage({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<Record<string,string|undefined>>}){
  const {id}=await params
  const qs=await searchParams
  const workspace=await currentWorkspace();if(!workspace)redirect('/login')
  const db=supabaseAdmin()
  const [{data:taxpayer},{count:businessCount},{data:obligations},{data:submissions},{data:agentRows}]=await Promise.all([
    db.from('taxpayers').select('display_name,nino').eq('id',id).eq('firm_id',workspace.firmId).maybeSingle(),
    db.from('hmrc_businesses').select('id',{count:'exact',head:true}).eq('taxpayer_id',id).eq('firm_id',workspace.firmId),
    db.from('hmrc_obligations').select('period_start,period_end,status').eq('taxpayer_id',id).eq('firm_id',workspace.firmId).gte('period_start','2025-04-06'),
    db.from('hmrc_quarterly_submissions').select('tax_year,status').eq('taxpayer_id',id).eq('firm_id',workspace.firmId).eq('status','submitted'),
    db.from('mtd_agent_authorisations').select('agent_id,expires_at,mtd_agents(agent_name,organisation_name,hmrc_arn,status)').eq('taxpayer_id',id).eq('firm_id',workspace.firmId).eq('status','authorised').eq('can_submit_final_declaration',true)
  ])
  if(!taxpayer)redirect('/taxpayers')
  const finalAgents=(agentRows||[]).filter((r:any)=>(!r.expires_at||new Date(r.expires_at).getTime()>Date.now())&&(!r.mtd_agents?.status||r.mtd_agents.status==='active'))
  const selectedActingAgentId=finalAgents.some((r:any)=>r.agent_id===qs.actingAgentId)?String(qs.actingAgentId):''
  const years=Array.from(new Set([...(obligations||[]).map((o:any)=>taxYearFromDate(o.period_start)),...(submissions||[]).map((s:any)=>s.tax_year).filter(Boolean)])).sort().reverse()
  const selected=qs.taxYear&&years.includes(qs.taxYear)?qs.taxYear:(years[0]||'2026-27')
  const [{data:storedRows},{data:reviews}]=await Promise.all([
    db.from('mtd_submission_audit').select('calculation_id,response_summary,response_payload,hmrc_correlation_id,created_at').eq('taxpayer_id',id).eq('firm_id',workspace.firmId).eq('tax_year',selected).eq('event_type','tax_calculation_retrieval').eq('status','accepted').order('created_at',{ascending:false}).limit(1),
    db.from('mtd_year_end_reviews').select('section,status').eq('taxpayer_id',id).eq('firm_id',workspace.firmId).eq('tax_year',selected),
  ])
  const stored:any=storedRows?.[0]||null
  const result:any=stored?.response_summary||stored?.response_payload||null
  const calculationId=String(qs.calculationId||stored?.calculation_id||result?.metadata?.calculationId||'')
  const hasCompletedCalculation=Boolean(result&&calculationId)
  const totalIncomeTax=findNumber(result,['totalIncomeTaxAndNicsDue','totalIncomeTaxDue','incomeTaxDueAfterTaxReductions','incomeTaxDue'])
  const totalTaxableIncome=findNumber(result,['totalTaxableIncome','totalIncomeReceivedFromAllSources','totalIncome'])
  const totalTaxDue=findNumber(result,['totalTaxDue','totalTaxAndNicsDue','totalIncomeTaxAndNicsDue'])
  const totalTaxDeducted=findNumber(result,['totalTaxDeducted','taxDeductedAtSource','totalTaxPaid'])
  const allowances=findNumber(result,['totalAllowancesAndDeductions','allowancesAllocated','personalAllowance'])
  const messages=result?collectMessages(result).slice(0,8):[]
  const readiness=yearEndFinalisationStatus({taxYear:selected,businessCount:businessCount||0,obligations:obligations||[],reviews:reviews||[]})
  const hasSandboxValues=sandboxSignal(result)

  return <div className="shell"><TaxpayerSidebar taxpayerId={id} active="calculations"/><main className="main">
    <div className="top"><div><h1 className="pageTitle">HMRC Tax Calculation</h1><p className="muted">Check HMRC's calculation before submitting the MTD for Income Tax return.</p></div><span className="badge">Individual Calculations API v8.0</span></div>
    {qs.error&&<div className="status statusError"><strong>HMRC calculation needs attention.</strong><div>{qs.error}</div>{qs.correlationId&&<div className="muted">HMRC correlation ID: {qs.correlationId}</div>}</div>}
    <section className="panel"><h2>Tax calculation</h2><p className="muted">MTD Lab displays HMRC's calculation and preserves the latest accepted HMRC result for the selected tax year.</p><form method="post" action="/api/hmrc/calculations/trigger"><input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="calculationType" value="in-year"/><label>Tax year</label><select className="selectField" name="taxYear" defaultValue={selected}>{years.length?years.map(y=><option key={y} value={y}>{y}</option>):<option value="2026-27">2026-27</option>}</select>{finalAgents.length>0&&<><label htmlFor="triggerActingAgentId">Acting as</label><select id="triggerActingAgentId" name="actingAgentId" className="selectField" defaultValue={selectedActingAgentId}><option value="">Taxpayer or direct operator</option>{finalAgents.map((r:any)=><option key={r.agent_id} value={r.agent_id}>{agentLabel(r)}</option>)}</select></>}<FraudContextFields/><button className="btn" type="submit">Trigger HMRC tax calculation</button></form></section>
    <section className="panel" style={{marginTop:16}}><div className="sectionHead"><div><h2>HMRC calculation result</h2><p className="muted">Retrieve and check the completed calculation before declaration.</p></div>{calculationId&&<form method="post" action="/api/hmrc/calculations/retrieve"><input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="taxYear" value={selected}/><input type="hidden" name="calculationId" value={calculationId}/>{selectedActingAgentId&&<input type="hidden" name="actingAgentId" value={selectedActingAgentId}/>}<FraudContextFields/><button className="btn btnSmall" type="submit">Retrieve calculation</button></form>}</div>{calculationId?<div className="mono">Calculation ID: {calculationId}</div>:<p className="empty">Trigger a calculation to create an HMRC calculation ID.</p>}{result&&<>
      {hasSandboxValues&&<div className="status" style={{marginTop:14}}><strong>HMRC sandbox response</strong><div>This calculation contains HMRC test fixture values. Figures labelled “Sandbox test value” must not be treated as a real tax liability.</div></div>}
      <div className="cards" style={{marginTop:14}}><div className="card"><span className="eyebrow">Taxable income</span><strong>{gbp(totalTaxableIncome)}</strong></div><div className="card"><span className="eyebrow">Income tax and NICs</span><strong>{gbp(totalIncomeTax)}</strong></div><div className="card"><span className="eyebrow">Total tax due</span><strong>{gbp(totalTaxDue)}</strong></div><div className="card"><span className="eyebrow">Calculation type</span><strong>{result?.metadata?.calculationType||'HMRC calculation'}</strong></div></div>
      <div className="grid3" style={{marginTop:14}}><section className="panel"><div className="muted">Allowances and deductions</div><div className="metric">{gbp(allowances)}</div></section><section className="panel"><div className="muted">Tax already deducted</div><div className="metric">{gbp(totalTaxDeducted)}</div></section><section className="panel"><div className="muted">Calculation status</div><div className="metric">Retrieved</div></section></div>
      {stored&&<p className="muted">Showing the latest accepted HMRC calculation saved on {new Date(stored.created_at).toLocaleString('en-GB')}.</p>}{messages.length>0&&<div className="status"><strong>HMRC messages</strong><ul>{messages.map((m,i)=><li key={i}>{m}</li>)}</ul></div>}
      <details><summary>Developer / HMRC raw response</summary><p className="muted">Technical sandbox payload for diagnostics. It is not the normal accountant or taxpayer view.</p><pre style={{whiteSpace:'pre-wrap',maxHeight:520,overflow:'auto'}}>{JSON.stringify(result,null,2)}</pre></details></>}</section>
    <section className="panel" style={{marginTop:16}}><h2>Submit Income Tax return</h2><p className="muted">Only submit after digital records, quarterly updates, year end adjustments, reliefs, allowances and other relevant Income Tax information are complete and the HMRC calculation has been checked.</p>{!readiness.canFinalise?<div className="status statusError"><strong>Not available yet.</strong><div>{readiness.blockers.join('. ')}.</div></div>:!hasCompletedCalculation?<div className="status statusError">Retrieve a completed HMRC calculation first.</div>:<form method="post" action="/api/hmrc/calculations/final-declaration"><input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="taxYear" value={selected}/><input type="hidden" name="calculationId" value={calculationId}/><label htmlFor="actingAgentId">Acting as</label><select id="actingAgentId" name="actingAgentId" className="selectField" defaultValue={selectedActingAgentId}><option value="">Taxpayer or direct operator</option>{finalAgents.map((r:any)=><option key={r.agent_id} value={r.agent_id}>{agentLabel(r)}</option>)}</select>{finalAgents.length===0&&<p className="muted">No agent currently has Final Declaration permission for this taxpayer. This does not prevent a direct taxpayer submission.</p>}<FraudContextFields/><label style={{display:'flex',gap:10,alignItems:'flex-start',margin:'14px 0'}}><input type="checkbox" name="declarationConfirmed" value="yes" required/><span>I confirm that the information for this MTD for Income Tax return is correct and complete to the best of my knowledge.</span></label><button className="btn" type="submit">Submit Income Tax return declaration to HMRC</button></form>}</section>
  </main></div>
}
