import Link from 'next/link'
import TaxpayerSidebar from '@/app/components/TaxpayerSidebar'
import FraudContextFields from '@/app/components/FraudContextFields'
import HmrcAttemptStatus from '@/app/components/HmrcAttemptStatus'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { latestHmrcAttempt, latestHmrcResponse } from '@/lib/hmrc-response-audit'
import { currentWorkspace } from '@/lib/workspace'

export const dynamic='force-dynamic'

function gbp(v:any){return new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Number(v||0))}
function ended(taxYear:string){const y=Number(taxYear.slice(0,4));return new Date()>new Date(`${y+1}-04-05T23:59:59Z`)}

function MoneyField({name,label,help}:{name:string,label:string,help:string}){
 return <label style={{display:'grid',gap:7,minWidth:0,fontWeight:700}}>
  <span>{label}</span>
  <input
   className="field"
   name={name}
   inputMode="decimal"
   placeholder="0.00"
   style={{margin:0,width:'100%'}}
  />
  <span className="muted" style={{fontWeight:400,lineHeight:1.45}}>{help}</span>
 </label>
}

export default async function TaxLiabilityPage({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<Record<string,string|undefined>>}){
 const {id}=await params
 const qs=await searchParams
 const db=supabaseAdmin()
 const workspace=await currentWorkspace()
 const firmId=workspace?.firmId||''
 const {data:obligations}=firmId?await db.from('hmrc_obligations').select('period_start').eq('taxpayer_id',id).eq('firm_id',firmId).gte('period_start','2025-04-06'):{data:[] as any[]}
 const years:string[]=Array.from(new Set<string>((obligations||[]).map((o:any)=>{const y=Number(String(o.period_start).slice(0,4));return `${y}-${String(y+1).slice(-2)}`}))).sort().reverse()
 const selected=qs.taxYear&&years.includes(qs.taxYear)?qs.taxYear:(years[0]||'2026-27')
 const stored=await latestHmrcResponse(db,{taxpayerId:id,taxYear:selected,eventType:'tax_liability_retrieval'})
 const latestAttempt=await latestHmrcAttempt(db,{taxpayerId:id,taxYear:selected,eventType:'tax_liability_retrieval'})
 const result:any=stored?.response_summary||stored?.response_payload||null
 const yearEnded=ended(selected)

 return <div className="shell"><TaxpayerSidebar taxpayerId={id} active="tax-liability"/><main className="main">
  <div className="top">
   <div>
    <h1 className="pageTitle">Tax Liability Adjustments</h1>
    <p className="muted">Retrieve, review and, when permitted, create or amend HMRC tax liability adjustments before final declaration.</p>
   </div>
   <span className="badge">{selected}</span>
  </div>

  {qs.error&&<div className="status statusError"><strong>HMRC needs attention.</strong><div>{qs.error}</div>{qs.correlationId&&<div className="muted">Correlation ID: {qs.correlationId}</div>}</div>}
  {qs.saved&&<div className="status"><strong>Tax liability adjustments accepted by HMRC.</strong>{qs.correlationId&&<div className="muted">Correlation ID: {qs.correlationId}</div>}</div>}

  <section className="panel">
   <div className="sectionHead">
    <div>
     <h2>HMRC adjustments for this tax year</h2>
     <p className="muted">Retrieve any existing HMRC adjustment before entering or changing figures.</p>
    </div>
    <form method="get">
     <select className="selectField" name="taxYear" defaultValue={selected}>{years.length?years.map(y=><option key={y} value={y}>{y}</option>):<option value={selected}>{selected}</option>}</select>
     <button className="btn btnSmall" type="submit">Change year</button>
    </form>
   </div>

   <div className="status" style={{marginTop:16}}>
    <strong>Recommended first step</strong>
    <div className="muted">Retrieve HMRC data before preparing an amendment so the existing tax liability position can be reviewed first.</div>
   </div>

   <form method="get" action="/api/hmrc/tax-liability/retrieve">
    <input type="hidden" name="taxpayerId" value={id}/>
    <input type="hidden" name="taxYear" value={selected}/>
    <button className="btn btnSmall" type="submit">Retrieve from HMRC</button>
   </form>
   {!qs.error&&<HmrcAttemptStatus attempt={latestAttempt} label="Tax liability adjustments"/>}

   {qs.retrieved&&result&&<div style={{marginTop:18}}>
    <div className="cards">
     <div className="card"><span className="eyebrow">Income Tax decrease</span><strong>{gbp(result?.carryBackLossesDecrease?.incomeTax)}</strong></div>
     <div className="card"><span className="eyebrow">Class 4 NIC decrease</span><strong>{gbp(result?.carryBackLossesDecrease?.class4)}</strong></div>
     <div className="card"><span className="eyebrow">Capital Gains Tax decrease</span><strong>{gbp(result?.carryBackLossesDecrease?.capitalGainsTax)}</strong></div>
     <div className="card"><span className="eyebrow">Tax refunded or set off</span><strong>{gbp(result?.taxRefundedOrSetOff?.amount)}</strong></div>
    </div>
    <details style={{marginTop:12}}><summary>Developer / HMRC raw response</summary><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(result,null,2)}</pre></details>
   </div>}
  </section>

  <section className="panel" style={{marginTop:16}}>
   <div className="sectionHead">
    <div>
     <h2>Create or amend tax liability adjustments</h2>
     <p className="muted">Use this only after the related carry back loss claims have been recorded. HMRC requires this endpoint to be used after the tax year has ended.</p>
    </div>
    {!yearEnded&&<span className="statusPill statusOpen">Submission locked</span>}
   </div>

   {!yearEnded&&<div className="status statusError">
    <strong>Tax year still in progress.</strong>
    <div className="muted">You may retrieve and review existing HMRC information now. Creating or amending tax liability adjustments remains disabled until the {selected} tax year has ended.</div>
   </div>}

   <form method="post" action="/api/hmrc/tax-liability/amend">
    <input type="hidden" name="taxpayerId" value={id}/>
    <input type="hidden" name="taxYear" value={selected}/>

    <h3>Carry back losses decrease</h3>
    <p className="muted">Enter only decreases that arise from valid carry back loss claims already recorded with HMRC.</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:18,marginTop:14}}>
     <MoneyField name="incomeTax" label="Income Tax decrease" help="Reduction in Income Tax resulting from the relevant carry back loss claim."/>
     <MoneyField name="class4" label="Class 4 NIC decrease" help="Reduction in Class 4 National Insurance resulting from the relevant carry back loss claim."/>
     <MoneyField name="capitalGainsTax" label="Capital Gains Tax decrease" help="Reduction in Capital Gains Tax resulting from the relevant carry back loss claim."/>
    </div>

    <div style={{borderTop:'1px solid #24385f',margin:'24px 0 20px'}}/>

    <h3>Tax refunded or set off</h3>
    <p className="muted">Record an amount only where HMRC has already refunded the tax or set it against another liability.</p>
    <div style={{display:'grid',gridTemplateColumns:'minmax(250px,520px)',gap:18,marginTop:14}}>
     <MoneyField name="taxRefundedOrSetOff" label="Amount already refunded or set off" help="Total amount already repaid or offset by HMRC in relation to this adjustment."/>
    </div>

    <div style={{marginTop:22}}><FraudContextFields/></div>

    <button
     className="btn"
     type="submit"
     disabled={!yearEnded}
     aria-disabled={!yearEnded}
     style={!yearEnded?{opacity:.55,cursor:'not-allowed'}:undefined}
    >{yearEnded?'Submit tax liability adjustments to HMRC':'Available after tax year end'}</button>
   </form>
  </section>

  <div style={{marginTop:16,display:'flex',gap:8,flexWrap:'wrap'}}>
   <Link className="btn btnSmall" href={`/taxpayers/${id}/end-of-year?taxYear=${encodeURIComponent(selected)}`}>Back to End of Year</Link>
   <Link className="btn btnSmall" href={`/taxpayers/${id}/end-of-year/adjustments?taxYear=${encodeURIComponent(selected)}`}>Annual Adjustments and Losses</Link>
   <Link className="btn btnSmall" href={`/taxpayers/${id}/calculations?taxYear=${encodeURIComponent(selected)}`}>HMRC Tax Calculation</Link>
  </div>
 </main></div>
}
