import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'
import TaxpayerSidebar from '@/app/components/TaxpayerSidebar'

export const dynamic='force-dynamic'

function isProperty(b:any){const t=String(b.business_type||'').toLowerCase();const r=JSON.stringify(b.raw||{}).toLowerCase();return t.includes('property')||r.includes('uk-property')||r.includes('property')}
function decode(value?:string){try{return value?JSON.parse(Buffer.from(value,'base64url').toString('utf8')):{}}catch{return {}}}
const n=(v:any)=>Number(v||0)

const selfFields=[
 ['turnover','Turnover'],['otherIncome','Other Income'],['taxTakenOff','Tax taken off trading income'],['costOfGoods','Cost of goods sold'],['cisPayments','CIS payments to subcontractors'],['staffCosts','Wages, salaries and other staff costs'],['travelCosts','Car, van and travel expenses'],['premisesCosts','Rent, rates, power and insurance costs'],['repairsMaintenance','Repairs and maintenance of property equipment'],['officeCosts','Phone, fax, stationery and other office costs'],['advertisingCosts','Advertising costs'],['businessEntertainment','Business entertainment costs'],['interestLoans','Interest on bank and other loans'],['financialCharges','Bank, credit card and other financial charges'],['badDebts','Irrecoverable debts written off'],['professionalFees','Accountancy, legal and other professional fees'],['depreciation','Depreciation and loss or profit on sale of assets'],['otherExpenses','Other business expenses']
]
const propertyFields=[
 ['rentalIncome','Rental Income'],['leasePremiums','Premiums of Lease Grant'],['reversePremiums','Reverse Premiums'],['otherPropertyIncome','Other Property Income'],['ukTaxDeducted','UK Tax Deducted'],['rentARoomReceived','Rent a Room Received'],['premisesRunningCosts','Premises Running Costs'],['repairsMaintenance','Repairs and Maintenance'],['financialCosts','Financial Costs'],['professionalFees','Professional Fees'],['travelCosts','Travel Costs'],['costOfServices','Cost of Services'],['otherCosts','Other Costs'],['rentARoomRelief','Rent a Room Relief'],['residentialFinancialCost','Residential Financial Cost'],['carryForwardResidentialFinanceCost','Carry Forward Residential Finance Cost']
]

export default async function SubmissionCentre({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<Record<string,string|undefined>>}){
 const {id}=await params;const qs=await searchParams;const db=supabaseAdmin()
 const [{data:taxpayer},{data:businesses}]=await Promise.all([db.from('taxpayers').select('*').eq('id',id).maybeSingle(),db.from('hmrc_businesses').select('*').eq('taxpayer_id',id).order('created_at')])
 const all=businesses||[];const propertyBusinesses=all.filter(isProperty);const selfBusinesses=all.filter((b:any)=>!isProperty(b));const hasProperty=propertyBusinesses.length>0
 let type=qs.type==='property'?'property':'self-employment';if(type==='property'&&!hasProperty)type='self-employment'
 const imported=decode(qs.imported);const fields=type==='property'?propertyFields:selfFields
 const selectedBusiness=(type==='property'?propertyBusinesses:selfBusinesses)[0]
 return <div className="shell"><TaxpayerSidebar taxpayerId={id} active="submissions"/><main className="main">
  <div className="top"><div><h1 className="pageTitle">Submission Centre</h1><p className="muted">Prepare MTD figures directly or import the MTD Lab Excel template.</p></div><span className="badge">{taxpayer?.display_name||id}</span></div>
  <div className="cards" style={{gridTemplateColumns:hasProperty?'1fr 1fr':'1fr'}}>
   <div className="card"><span className="eyebrow">Self Assessment</span><strong className="dateValue">Self Employment</strong><p className="muted">Use this route for sole trader or self employment income.</p><Link className="btn btnSmall" href={`/taxpayers/${id}/submissions?type=self-employment`}>Open self assessment</Link></div>
   {hasProperty&&<div className="card"><span className="eyebrow">Property owner submission</span><strong className="dateValue">UK Property</strong><p className="muted">Available because HMRC has returned a UK property income source for this taxpayer.</p><Link className="btn btnSmall" href={`/taxpayers/${id}/submissions?type=property`}>Open property account</Link></div>}
  </div>
  {qs.error&&<div className="status statusError">{qs.error}</div>}{qs.uploaded&&<div className="status"><strong>Template imported.</strong> Review the figures below before continuing.</div>}
  <section className="panel"><div className="sectionHead"><div><h2>{type==='property'?'UK Property Owner Submission':'Self Assessment, Self Employment'}</h2><p className="muted">{selectedBusiness?`HMRC business: ${selectedBusiness.business_name||selectedBusiness.business_id}`:'No matching HMRC business is currently available.'}</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><a className="btn btnSmall" href={`/api/templates/${type==='property'?'property':'self-employment'}`}>Download Excel template</a></div></div>
   <form method="post" action="/api/templates/upload" encType="multipart/form-data" style={{margin:'14px 0 22px'}}><input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="type" value={type}/><label><strong>Upload completed template</strong></label><div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginTop:8}}><input className="field" style={{maxWidth:430,margin:0}} type="file" name="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required/><button className="btn btnSmall" type="submit">Upload and import</button></div></form>
   <div className="tableWrap"><table><thead><tr><th>Account name</th><th>Total amount (£)</th>{type==='self-employment'&&<th>Disallowable amount (£)</th>}</tr></thead><tbody>{fields.map(([key,label],i)=><tr key={key}><td>{label}</td><td><input className="field" style={{margin:0,maxWidth:220}} type="number" step="0.01" min="0" name={key} defaultValue={n(imported[key])}/></td>{type==='self-employment'&&<td><input className="field" style={{margin:0,maxWidth:220}} type="number" step="0.01" min="0" name={`${key}Disallowable`} defaultValue={0}/></td>}</tr>)}</tbody></table></div>
   <div style={{display:'flex',gap:10,marginTop:18,flexWrap:'wrap'}}>{type==='self-employment'?<Link className="btn" href={`/taxpayers/${id}/quarterly${selectedBusiness?.business_id?`?businessId=${encodeURIComponent(selectedBusiness.business_id)}`:''}`}>Choose quarter and continue</Link>:<><Link className="btn" href={`/taxpayers/${id}/quarterly${selectedBusiness?.business_id?`?businessId=${encodeURIComponent(selectedBusiness.business_id)}`:''}`}>View property obligations</Link><span className="muted" style={{alignSelf:'center'}}>Property figures are kept separate from self employment figures.</span></>}</div>
  </section>
 </main></div>
}
