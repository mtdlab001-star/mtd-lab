import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'
import TaxpayerSidebar from '@/app/components/TaxpayerSidebar'
import { mergeMtdIncomeSources } from '@/lib/mtd-income-sources-server'
import { quarterlyPeriodIsAvailable } from '@/lib/quarterly-submission-eligibility'

export const dynamic='force-dynamic'

function fmtDate(value?:string|null){
  if(!value)return 'Not available'
  const d=new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime())?value:d.toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'})
}
function fmtDateTime(value?:string|null){
  if(!value)return 'Not submitted'
  const d=new Date(value)
  return Number.isNaN(d.getTime())?value:d.toLocaleString('en-GB')
}
function taxYearFor(value?:string|null){
  if(!value)return ''
  const [y,m,d]=value.split('-').map(Number)
  const start=m>4||(m===4&&d>=6)?y:y-1
  return `${start}/${String(start+1).slice(-2)}`
}
function visualStatus(o:any,submission?:any){
  const hmrc=String(o.status||'').toLowerCase()
  if(hmrc==='fulfilled')return {label:'Fulfilled',cls:'statusDone',accepted:true}
  if(submission?.status==='submitted'){
    const submittedAt=new Date(submission.submitted_at||submission.created_at||0)
    const age=Date.now()-submittedAt.getTime()
    if(Number.isFinite(age)&&age>=0&&age<1000*60*15)return {label:'Accepted, awaiting HMRC update',cls:'statusDone',accepted:true}
    return {label:'Accepted, obligation still open',cls:'statusOpen',accepted:true}
  }
  const due=o.due_date?new Date(`${o.due_date}T23:59:59Z`):null
  const now=new Date()
  if(due&&due<now)return {label:'Overdue',cls:'statusError',accepted:false}
  if(due&&due.getTime()-now.getTime()<1000*60*60*24*30)return {label:'Due soon',cls:'statusOpen',accepted:false}
  return {label:'Not due yet',cls:'statusOpen',accepted:false}
}

function cumulative(records:any[],businessId:string,periodEnd:string,type:string){
  const rs=records.filter(r=>r.business_id===businessId&&r.transaction_date<=periodEnd)
  const sum=(fn:(r:any)=>boolean)=>rs.filter(fn).reduce((s:number,r:any)=>s+Number(r.amount||0),0)
  const cat=(r:any)=>String(r.category||'').toLowerCase()
  const has=(r:any,keys:string[])=>keys.some(k=>cat(r).includes(k))
  const income=(r:any)=>r.record_type==='income'
  const expense=(r:any)=>r.record_type==='expense'

  if(type==='foreign-property'){
    const buckets=[
      ['premisesCosts',['premises','rent','rates','insurance','ground rent','utility']],
      ['repairsMaintenance',['repair','maintenance']],
      ['financialCosts',['finance cost','financial cost','mortgage interest','loan interest']],
      ['professionalFees',['professional','legal','management','account']],
      ['costOfServices',['service','cleaning','gardening']],
      ['travelCosts',['travel','mileage','vehicle']]
    ] as const
    const knownExpenseKeys=buckets.flatMap(([,keys])=>keys)
    const result:any={
      count:rs.length,
      rents:sum(r=>income(r)&&has(r,['rent','receipt'])),
      leasePremiums:sum(r=>income(r)&&has(r,['lease','premium'])),
      otherIncome:sum(r=>income(r)&&!has(r,['rent','receipt','lease','premium'])),
      otherExpenses:sum(r=>expense(r)&&!has(r,knownExpenseKeys))
    }
    for(const [name,keys] of buckets)result[name]=sum(r=>expense(r)&&has(r,[...keys]))
    return result
  }

  if(type==='uk-property'){
    const buckets=[
      ['premisesCosts',['premises','rent','rates','insurance','ground rent','utility']],
      ['repairsMaintenance',['repair','maintenance']],
      ['financialCosts',['finance cost','financial cost','mortgage interest','loan interest']],
      ['professionalFees',['professional','legal','management','account']],
      ['costOfServices',['service','cleaning','gardening']],
      ['travelCosts',['travel','mileage','vehicle']],
      ['rentARoomRelief',['rent a room relief']],
      ['residentialFinancialCost',['residential financial cost']],
      ['carryForwardResidentialFinanceCost',['carried forward','carry forward residential']]
    ] as const
    const knownExpenseKeys=buckets.flatMap(([,keys])=>keys)
    const result:any={
      count:rs.length,
      rents:sum(r=>income(r)&&has(r,['rent'])&&!has(r,['rent a room'])),
      leasePremiums:sum(r=>income(r)&&has(r,['lease','premium'])),
      reversePremiums:sum(r=>income(r)&&has(r,['reverse premium','inducement'])),
      otherIncome:sum(r=>income(r)&&!has(r,['rent','lease','premium','tax deducted','rent a room'])),
      ukTaxDeducted:sum(r=>income(r)&&has(r,['tax deducted','uk tax'])),
      rentARoomReceived:sum(r=>income(r)&&has(r,['rent a room'])),
      otherExpenses:sum(r=>expense(r)&&!has(r,knownExpenseKeys))
    }
    for(const [name,keys] of buckets)result[name]=sum(r=>expense(r)&&has(r,[...keys]))
    return result
  }

  const buckets=[
    ['costOfGoods',['goods','stock','materials','cost of sales']],
    ['cisPayments',['cis','subcontractor']],
    ['staffCosts',['staff','wage','salary','payroll']],
    ['travelCosts',['travel','car','vehicle','mileage']],
    ['premisesCosts',['premises','rent','rates','utility']],
    ['repairsMaintenance',['repair','maintenance']],
    ['officeCosts',['office','stationery','postage','telephone','internet']],
    ['advertisingCosts',['advert','marketing','promotion']],
    ['businessEntertainment',['entertainment']],
    ['interestLoans',['loan interest','interest on loan']],
    ['financialCharges',['bank charge','financial charge','finance charge']],
    ['badDebts',['bad debt','irrecoverable debt']],
    ['professionalFees',['professional','legal','account']],
    ['depreciation',['depreciation']],
  ] as const
  const knownKeys=buckets.flatMap(([,keys])=>keys)
  const result:any={
    count:rs.length,
    turnover:sum(r=>income(r)&&!has(r,['other','tax taken off','tax deducted'])),
    otherIncome:sum(r=>income(r)&&has(r,['other'])&&!has(r,['tax taken off','tax deducted'])),
    taxTakenOff:sum(r=>income(r)&&has(r,['tax taken off','tax deducted'])),
    otherExpenses:sum(r=>expense(r)&&!has(r,knownKeys))
  }
  for(const [name,keys] of buckets)result[name]=sum(r=>expense(r)&&has(r,[...keys]))
  return result
}

function MoneyField({name,label,value,required=false}:{name:string,label:string,value:number,required?:boolean}){
  return <div><label>{label} (£)</label><input className="field" name={name} type="number" min="0" step="0.01" required={required} defaultValue={Number(value||0).toFixed(2)}/></div>
}

export default async function QuarterlyPage({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<Record<string,string|undefined>>}){
  const {id}=await params
  const qs=await searchParams
  const db=supabaseAdmin()
  const [{data:taxpayer},{data:businesses},{data:obligations},{data:submissions}]=await Promise.all([
    db.from('taxpayers').select('*').eq('id',id).maybeSingle(),
    db.from('hmrc_businesses').select('*').eq('taxpayer_id',id).order('created_at'),
    db.from('hmrc_obligations').select('*').eq('taxpayer_id',id).gte('period_start','2025-04-06').order('period_end'),
    db.from('hmrc_quarterly_submissions').select('*').eq('taxpayer_id',id).order('created_at',{ascending:false})
  ])

  const sources=mergeMtdIncomeSources(businesses||[],obligations||[])
  const availableTypes=(['self-employment','uk-property','foreign-property'] as const).filter(sourceType=>sources.some(source=>source.sourceType===sourceType))
  const requestedSourceType=String(qs.sourceType||'')
  const requestedType=['self-employment','uk-property','foreign-property'].includes(requestedSourceType)?requestedSourceType:'self-employment'
  const requestedSource=sources.find(source=>source.businessId===qs.businessId)
  const selectedSource=requestedSource||sources.find(source=>source.sourceType===requestedType)||sources[0]
  const selectedBusiness=selectedSource?.businessId||''
  const sourceType=selectedSource?.sourceType||requestedType
  const sourceLabel=selectedSource?.businessName||(sourceType==='foreign-property'?'Foreign Property':sourceType==='uk-property'?'UK Property':'Self Assessment')
  const property=sourceType!=='self-employment'
  const rows=(obligations||[]).filter((o:any)=>!selectedBusiness||!o.business_id||o.business_id===selectedBusiness)
  const selectedPeriodEnd=qs.periodEnd||''
  const latestSubmission=(periodEnd:string)=>(submissions||[]).find((s:any)=>s.business_id===selectedBusiness&&s.period_end===periodEnd&&s.status==='submitted')
  const selectedObligation=!latestSubmission(selectedPeriodEnd)
    ? rows.find((o:any)=>o.period_end===selectedPeriodEnd&&String(o.status).toLowerCase()==='open')
    : null
  const {data:digitalRecords}=selectedObligation&&selectedBusiness
    ? await db.from('mtd_digital_records').select('*').eq('taxpayer_id',id).eq('business_id',selectedBusiness).lte('transaction_date',selectedObligation.period_end).order('transaction_date')
    : ({data:[]} as any)
  const quarterRows=rows.map((o:any,index:number)=>({o,quarter:index+1,submission:latestSubmission(o.period_end)}))
  const acceptedPending=quarterRows.filter((x:any)=>String(x.o.status).toLowerCase()!=='fulfilled'&&x.submission?.status==='submitted').length
  const totals:any=selectedObligation?cumulative(digitalRecords||[],selectedBusiness,selectedObligation.period_end,sourceType):null
  const yearLabel=rows[0]?.period_start?taxYearFor(rows[0].period_start):''
  const yearStart=yearLabel?yearLabel.split('/')[0]:''
  const annualDue=yearStart?`31/01/${Number(yearStart)+2}`:'After tax year end'

  return <div className="shell">
    <TaxpayerSidebar taxpayerId={id} active="quarterly" sourceTypes={availableTypes}/>
    <main className="main">
      <div className="top"><div><h1 className="pageTitle">Quarterly Obligations</h1><p className="muted">Retrieve, review and submit cumulative MTD Income Tax updates.</p></div><span className="badge">Sandbox</span></div>

      <section className="panel" style={{marginTop:20,marginBottom:16}}>
        <div className="sectionHead">
          <div><h2>{taxpayer?.display_name||'Taxpayer'}</h2><p className="muted">Select an HMRC income source to view its quarterly obligations.</p></div>
          <div style={{display:'flex',gap:8,alignItems:'end',flexWrap:'wrap'}}>
            <form method="get" className="filterForm" style={{minWidth:360}}>
              <label htmlFor="businessId">Income source</label>
              <select id="businessId" name="businessId" className="selectField" defaultValue={selectedBusiness}>{sources.map(source=><option key={source.businessId} value={source.businessId}>{source.businessName||source.businessId} ({source.sourceType==='foreign-property'?'Foreign Property':source.sourceType==='uk-property'?'UK Property':'Self Assessment'})</option>)}</select>
              <button className="btn btnSmall" type="submit">Select</button>
            </form>
            <form method="post" action="/api/hmrc/sync"><input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="nino" value={taxpayer?.nino||''}/><input type="hidden" name="mtditid" value={taxpayer?.mtditid||''}/><button className="btn btnSmall" type="submit">Retrieve Obligations</button></form>
          </div>
        </div>
      </section>

      {acceptedPending>0&&<div className="status">{acceptedPending} quarterly update{acceptedPending===1?' has':'s have'} been accepted by HMRC but the corresponding obligation is still open. Use Retrieve Obligations to refresh HMRC status. The accepted submission remains recorded in Submission History.</div>}
      {qs.error&&<div className="status statusError"><strong>Quarterly submission is blocked.</strong><div>{qs.error}</div></div>}

      <section className="panel">
        <div className="detailGrid" style={{marginBottom:16}}><div><span className="eyebrow">Selected income source</span><strong>{sourceLabel}</strong>{selectedSource?.fallback&&<div className="muted">Identified from HMRC obligations</div>}</div><div><span className="eyebrow">Business ID</span><strong className="mono">{selectedBusiness||'Not selected'}</strong></div></div>
        <div className="tableWrap"><table><thead><tr><th>Period</th><th>Period Dates</th><th>Due Date</th><th>Submission Date & Time</th><th>Status</th><th>Action</th></tr></thead><tbody>{quarterRows.length?quarterRows.map(({o,quarter,submission}:any)=>{const st=visualStatus(o,submission);const fulfilled=String(o.status).toLowerCase()==='fulfilled';const available=quarterlyPeriodIsAvailable(String(o.period_end||''));return <tr key={o.id}><td><strong>Quarter {quarter}</strong></td><td>{fmtDate(o.period_start)} to {fmtDate(o.period_end)}</td><td>{fmtDate(o.due_date)}</td><td>{fmtDateTime(submission?.submitted_at||submission?.created_at)}</td><td><span className={`statusPill ${st.cls}`}>{st.label}</span></td><td>{fulfilled||st.accepted?<Link className="btn btnSmall" href={`/taxpayers/${id}/quarterly/history?businessId=${encodeURIComponent(selectedBusiness)}&periodEnd=${encodeURIComponent(o.period_end)}&sourceType=${encodeURIComponent(sourceType)}`}>View</Link>:<Link className="btn btnSmall" href={`/taxpayers/${id}/quarterly?businessId=${encodeURIComponent(selectedBusiness)}&periodEnd=${encodeURIComponent(o.period_end)}&sourceType=${encodeURIComponent(sourceType)}`}>{available?'Submit':'Prepare / Review'}</Link>}</td></tr>}):<tr><td colSpan={6} className="empty">No eligible quarterly obligations are available for this income source.</td></tr>}</tbody></table></div>
      </section>

      {property&&<section className="panel" style={{marginTop:16}}><div className="sectionHead"><div><h2>{sourceLabel} Annual Submission</h2><p className="muted">Complete the annual property information and year end adjustments for {yearLabel||'the selected tax year'} after quarterly updates are complete.</p></div><Link className="btn" href={`/taxpayers/${id}/end-of-year${yearStart?`?taxYear=${yearStart}-${String(Number(yearStart)+1).slice(-2)}`:''}`}>Annual Submission</Link></div><div className="detailGrid"><div><span className="eyebrow">Income source</span><strong>{sourceLabel}</strong></div><div><span className="eyebrow">Tax return deadline</span><strong>{annualDue}</strong></div></div></section>}

      {selectedObligation&&totals&&<section className="panel" style={{marginTop:16}}>
        <div className="sectionHead"><div><h2>Prepare Quarter {Math.max(1,quarterRows.find((x:any)=>x.o.id===selectedObligation.id)?.quarter||1)} cumulative update</h2><p className="muted">{sourceLabel} cumulative totals to {fmtDate(selectedObligation.period_end)}, prefilled from {totals.count} digital record(s). Review before submission.</p></div><div style={{display:'flex',gap:8}}><Link className="btn btnSmall" href={`/taxpayers/${id}/digital-records?businessId=${encodeURIComponent(selectedBusiness)}&sourceType=${encodeURIComponent(sourceType)}`}>Review digital records</Link><Link className="btn btnSmall" href={`/taxpayers/${id}/quarterly?businessId=${encodeURIComponent(selectedBusiness)}&sourceType=${encodeURIComponent(sourceType)}`}>Close</Link></div></div>

        <form method="post" action="/api/hmrc/quarterly/prepare">
          <input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="businessId" value={selectedBusiness}/><input type="hidden" name="incomeSourceType" value={sourceType}/><input type="hidden" name="periodStart" value={selectedObligation.period_start}/><input type="hidden" name="periodEnd" value={selectedObligation.period_end}/>

          {sourceType==='foreign-property'?<>
            <h3>Foreign property income</h3>
            <div className="two"><MoneyField name="rents" label="Total rents and other receipts" value={totals.rents}/><MoneyField name="leasePremiums" label="Premiums for grant of a lease" value={totals.leasePremiums}/></div>
            <MoneyField name="otherIncome" label="Other foreign property income" value={totals.otherIncome}/>
            <h3>Allowable expenses</h3>
            <div className="two">
              <div>
                <MoneyField name="premisesCosts" label="Rent, rates, insurance and ground rents" value={totals.premisesCosts}/>
                <MoneyField name="repairsMaintenance" label="Property repairs and maintenance" value={totals.repairsMaintenance}/>
                <MoneyField name="financialCosts" label="Property finance costs" value={totals.financialCosts}/>
                <MoneyField name="professionalFees" label="Legal, management and professional fees" value={totals.professionalFees}/>
              </div>
              <div>
                <MoneyField name="costOfServices" label="Costs of services provided" value={totals.costOfServices}/>
                <MoneyField name="travelCosts" label="Travel expenses" value={totals.travelCosts}/>
                <MoneyField name="otherExpenses" label="Other allowable foreign property expenses" value={totals.otherExpenses}/>
              </div>
            </div>
          </>:sourceType==='uk-property'?<>
            <h3>UK property income</h3>
            <div className="two"><MoneyField name="rents" label="Total rent" value={totals.rents}/><MoneyField name="leasePremiums" label="Premiums for grant of a lease" value={totals.leasePremiums}/></div>
            <div className="two"><MoneyField name="reversePremiums" label="Reverse premiums and inducements" value={totals.reversePremiums}/><MoneyField name="otherIncome" label="Other property income" value={totals.otherIncome}/></div>
            <div className="two"><MoneyField name="ukTaxDeducted" label="UK tax deducted" value={totals.ukTaxDeducted}/><MoneyField name="rentARoomReceived" label="Rent a Room received" value={totals.rentARoomReceived}/></div>
            <h3>Allowable expenses</h3>
            <div className="two">
              <div>
                <MoneyField name="premisesCosts" label="Rent, rates, insurance and ground rents" value={totals.premisesCosts}/>
                <MoneyField name="repairsMaintenance" label="Property repairs and maintenance" value={totals.repairsMaintenance}/>
                <MoneyField name="financialCosts" label="Property finance costs" value={totals.financialCosts}/>
                <MoneyField name="professionalFees" label="Legal, management and professional fees" value={totals.professionalFees}/>
                <MoneyField name="costOfServices" label="Costs of services provided" value={totals.costOfServices}/>
              </div>
              <div>
                <MoneyField name="travelCosts" label="Travel expenses" value={totals.travelCosts}/>
                <MoneyField name="otherExpenses" label="Other allowable property expenses" value={totals.otherExpenses}/>
                <MoneyField name="rentARoomRelief" label="Rent a Room relief" value={totals.rentARoomRelief}/>
                <MoneyField name="residentialFinancialCost" label="Residential financial cost" value={totals.residentialFinancialCost}/>
                <MoneyField name="carryForwardResidentialFinanceCost" label="Residential finance cost carried forward" value={totals.carryForwardResidentialFinanceCost}/>
              </div>
            </div>
          </>:<>
            <h3>Business income</h3>
            <div className="two"><MoneyField name="turnover" label="Turnover / income" value={totals.turnover} required/><MoneyField name="otherIncome" label="Other business income" value={totals.otherIncome}/></div>
            <MoneyField name="taxTakenOff" label="Tax taken off trading income" value={totals.taxTakenOff}/>

            <h3>Allowable expenses</h3>
            <div className="two">
              <div>
                <MoneyField name="costOfGoods" label="Cost of goods sold" value={totals.costOfGoods}/>
                <MoneyField name="cisPayments" label="CIS payments to subcontractors" value={totals.cisPayments}/>
                <MoneyField name="staffCosts" label="Wages and staff costs" value={totals.staffCosts}/>
                <MoneyField name="travelCosts" label="Car, van and travel expenses" value={totals.travelCosts}/>
                <MoneyField name="premisesCosts" label="Premises running costs" value={totals.premisesCosts}/>
                <MoneyField name="repairsMaintenance" label="Repairs and maintenance" value={totals.repairsMaintenance}/>
                <MoneyField name="officeCosts" label="Office costs" value={totals.officeCosts}/>
                <MoneyField name="advertisingCosts" label="Advertising costs" value={totals.advertisingCosts}/>
              </div>
              <div>
                <MoneyField name="businessEntertainment" label="Business entertainment" value={totals.businessEntertainment}/>
                <MoneyField name="interestLoans" label="Interest on loans" value={totals.interestLoans}/>
                <MoneyField name="financialCharges" label="Financial charges" value={totals.financialCharges}/>
                <MoneyField name="badDebts" label="Irrecoverable debts" value={totals.badDebts}/>
                <MoneyField name="professionalFees" label="Professional fees" value={totals.professionalFees}/>
                <MoneyField name="depreciation" label="Depreciation" value={totals.depreciation}/>
                <MoneyField name="otherExpenses" label="Other expenses" value={totals.otherExpenses}/>
              </div>
            </div>
          </>}

          <button className="btn" type="submit">Review quarterly update</button>
        </form>
      </section>}
    </main>
  </div>
}