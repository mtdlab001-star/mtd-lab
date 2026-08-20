import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'
import TaxpayerSidebar from '@/app/components/TaxpayerSidebar'

export const dynamic='force-dynamic'

function isProperty(b:any){const t=String(b.business_type||'').toLowerCase();const r=JSON.stringify(b.raw||{}).toLowerCase();return t.includes('property')||r.includes('uk-property')||r.includes('property')}
function decode(value?:string){try{return value?JSON.parse(Buffer.from(value,'base64url').toString('utf8')):{}}catch{return {}}}
function fmtDate(value?:string|null){if(!value)return '';return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
const n=(v:any)=>Number(v||0)

const selfFields=[
 ['turnover','Turnover'],['otherIncome','Other Income'],['taxTakenOff','Tax taken off trading income'],['costOfGoods','Cost of goods sold'],['cisPayments','CIS payments to subcontractors'],['staffCosts','Wages, salaries and other staff costs'],['travelCosts','Car, van and travel expenses'],['premisesCosts','Rent, rates, power and insurance costs'],['repairsMaintenance','Repairs and maintenance of property equipment'],['officeCosts','Phone, fax, stationery and other office costs'],['advertisingCosts','Advertising costs'],['businessEntertainment','Business entertainment costs'],['interestLoans','Interest on bank and other loans'],['financialCharges','Bank, credit card and other financial charges'],['badDebts','Irrecoverable debts written off'],['professionalFees','Accountancy, legal and other professional fees'],['depreciation','Depreciation and loss or profit on sale of assets'],['otherExpenses','Other business expenses']
]
const propertyFields=[
 ['rentalIncome','Rental Income'],['leasePremiums','Premiums of Lease Grant'],['reversePremiums','Reverse Premiums'],['otherPropertyIncome','Other Property Income'],['ukTaxDeducted','UK Tax Deducted'],['rentARoomReceived','Rent a Room Received'],['premisesRunningCosts','Premises Running Costs'],['repairsMaintenance','Repairs and Maintenance'],['financialCosts','Financial Costs'],['professionalFees','Professional Fees'],['travelCosts','Travel Costs'],['costOfServices','Cost of Services'],['otherCosts','Other Costs'],['rentARoomRelief','Rent a Room Relief'],['residentialFinancialCost','Residential Financial Cost'],['carryForwardResidentialFinanceCost','Carry Forward Residential Finance Cost']
]

export default async function SubmissionCentre({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<Record<string,string|undefined>>}){
 const {id}=await params;const qs=await searchParams;const db=supabaseAdmin()
 const [{data:taxpayer},{data:businesses},{data:obligations}]=await Promise.all([
  db.from('taxpayers').select('*').eq('id',id).maybeSingle(),
  db.from('hmrc_businesses').select('*').eq('taxpayer_id',id).order('created_at'),
  db.from('hmrc_obligations').select('*').eq('taxpayer_id',id).gte('period_start','2025-04-06').order('period_end')
 ])
 const all=businesses||[];const propertyBusinesses=all.filter(isProperty);const selfBusinesses=all.filter((b:any)=>!isProperty(b));const hasProperty=propertyBusinesses.length>0
 let type=qs.type==='property'?'property':'self-employment';if(type==='property'&&!hasProperty)type='self-employment'
 const imported=decode(qs.imported);const fields=type==='property'?propertyFields:selfFields
 const matchingBusinesses=type==='property'?propertyBusinesses:selfBusinesses
 const selectedBusinessId=qs.businessId||matchingBusinesses[0]?.business_id||''
 const selectedBusiness=matchingBusinesses.find((b:any)=>b.business_id===selectedBusinessId)||matchingBusinesses[0]
 const businessPeriods=(obligations||[]).filter((o:any)=>!o.business_id||o.business_id===selectedBusiness?.business_id)
 const openPeriods=businessPeriods.filter((o:any)=>String(o.status).toLowerCase()==='open')
 const selectedPeriodEnd=qs.periodEnd||openPeriods[0]?.period_end||''
 const selectedPeriod=openPeriods.find((o:any)=>o.period_end===selectedPeriodEnd)||openPeriods[0]
 const quarterNumber=(o:any)=>Math.max(1,businessPeriods.findIndex((p:any)=>p.id===o.id)+1)
 return <div className="shell"><TaxpayerSidebar taxpayerId={id} active="submissions"/><main className="main">
  <div className="top"><div><h1 className="pageTitle">Submission Centre</h1><p className="muted">Prepare cumulative MTD figures directly or import an MTD Lab Excel template.</p></div><span className="badge">{taxpayer?.display_name||id}</span></div>
  <div className="cards" style={{gridTemplateColumns:hasProperty?'1fr 1fr':'1fr'}}>
   <div className="card"><span className="eyebrow">Self Assessment</span><strong className="dateValue">Self Employment</strong><p className="muted">Sole trader and self employment cumulative quarterly updates.</p><Link className="btn btnSmall" href={`/taxpayers/${id}/submissions?type=self-employment`}>Open self employment</Link></div>
   {hasProperty&&<div className="card"><span className="eyebrow">Property owner submission</span><strong className="dateValue">UK Property</strong><p className="muted">Separate UK property cumulative quarterly filing.</p><Link className="btn btnSmall" href={`/taxpayers/${id}/submissions?type=property`}>Open property account</Link></div>}
  </div>
  {qs.error&&<div className="status statusError">{qs.error}</div>}{qs.uploaded&&<div className="status"><strong>Template imported.</strong> Review the figures and choose the HMRC quarter below.</div>}
  <section className="panel"><div className="sectionHead"><div><h2>{type==='property'?'UK Property Owner Submission':'Self Assessment, Self Employment'}</h2><p className="muted">Figures are submitted cumulatively from the beginning of the tax year to the selected period end.</p></div><a className="btn btnSmall" href={`/api/templates/${type==='property'?'property':'self-employment'}`}>Download Excel template</a></div>
   <form method="post" action="/api/templates/upload" encType="multipart/form-data" style={{margin:'14px 0 22px'}}><input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="type" value={type}/><label><strong>Upload completed template</strong></label><div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginTop:8}}><input className="field" style={{maxWidth:430,margin:0}} type="file" name="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required/><button className="btn btnSmall" type="submit">Upload and import</button></div></form>
   <form method="post" action="/api/hmrc/quarterly/prepare">
    <input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="filingType" value={type}/><input type="hidden" name="businessId" value={selectedBusiness?.business_id||''}/><input type="hidden" name="periodStart" value={selectedPeriod?.period_start||''}/><input type="hidden" name="periodEnd" value={selectedPeriod?.period_end||''}/>
    <div className="detailGrid"><div><span className="eyebrow">Business</span><strong>{selectedBusiness?.business_name||'No matching HMRC business'}</strong><div className="mono muted">{selectedBusiness?.business_id||''}</div></div><div><span className="eyebrow">Selected cumulative period</span><strong>{selectedPeriod?`${fmtDate(selectedPeriod.period_start)} to ${fmtDate(selectedPeriod.period_end)}`:'No open eligible period'}</strong><div className="muted">{selectedPeriod?.due_date?`Due ${fmtDate(selectedPeriod.due_date)}`:''}</div></div></div>
    {matchingBusinesses.length>1&&<div style={{marginBottom:14}}><label>Business</label><select className="selectField" defaultValue={selectedBusiness?.business_id} onChange={undefined}>{matchingBusinesses.map((b:any)=><option key={b.id} value={b.business_id}>{b.business_name||b.business_id}</option>)}</select><p className="muted">Use the business selector on the Quarterly Updates page to switch between multiple HMRC businesses.</p></div>}
    <div style={{marginBottom:18}}><label><strong>Quarter to file</strong></label><div className="two" style={{marginTop:8}}>{openPeriods.length?openPeriods.map((o:any)=><Link key={o.id} className="btn btnSmall" href={`/taxpayers/${id}/submissions?type=${type}&businessId=${encodeURIComponent(selectedBusiness?.business_id||'')}&periodEnd=${encodeURIComponent(o.period_end)}${qs.imported?`&imported=${encodeURIComponent(qs.imported)}`:''}`}>Quarter {quarterNumber(o)}, to {fmtDate(o.period_end)}</Link>):<div className="status statusError">No open modern MTD obligation is available for this income source.</div>}</div></div>
    <div className="tableWrap"><table><thead><tr><th>Account name</th><th>Total amount (£)</th>{type==='self-employment'&&<th>Disallowable amount (£)</th>}</tr></thead><tbody>{fields.map(([key,label])=><tr key={key}><td>{label}</td><td><input className="field" style={{margin:0,maxWidth:220}} type="number" step="0.01" name={key} defaultValue={n(imported[key])}/></td>{type==='self-employment'&&<td>{['turnover','otherIncome','taxTakenOff'].includes(key)?<span className="muted">Not applicable</span>:<input className="field" style={{margin:0,maxWidth:220}} type="number" step="0.01" name={`${key}Disallowable`} defaultValue={n(imported[`${key}Disallowable`])}/>}</td>}</tr>)}</tbody></table></div>
    <div style={{display:'flex',gap:10,marginTop:18,flexWrap:'wrap'}}><button className="btn" type="submit" disabled={!selectedBusiness||!selectedPeriod}>Review {type==='property'?'property':'self employment'} update</button><Link className="btn btnSmall" href={`/taxpayers/${id}/quarterly${selectedBusiness?.business_id?`?businessId=${encodeURIComponent(selectedBusiness.business_id)}`:''}`}>View obligations</Link></div>
   </form>
  </section>
 </main></div>
}
