import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'
import TaxpayerSidebar from '@/app/components/TaxpayerSidebar'
import { incomeSourceType, incomeSourceTypeFromBusinessId, type MtdIncomeSourceType } from '@/lib/mtd-income-source'
import { currentWorkspace } from '@/lib/workspace'

export const dynamic='force-dynamic'

function decode(value?:string){try{return value?JSON.parse(Buffer.from(value,'base64url').toString('utf8')):{}}catch{return {}}}
function fmtDate(value?:string|null){if(!value)return '';return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
const n=(v:any)=>Number(v||0)

const selfFields=[
 ['turnover','Turnover'],['otherIncome','Other Income'],['taxTakenOff','Tax taken off trading income'],['costOfGoods','Cost of goods sold'],['cisPayments','CIS payments to subcontractors'],['staffCosts','Wages, salaries and other staff costs'],['travelCosts','Car, van and travel expenses'],['premisesCosts','Rent, rates, power and insurance costs'],['repairsMaintenance','Repairs and maintenance of property equipment'],['officeCosts','Phone, fax, stationery and other office costs'],['advertisingCosts','Advertising costs'],['businessEntertainment','Business entertainment costs'],['interestLoans','Interest on bank and other loans'],['financialCharges','Bank, credit card and other financial charges'],['badDebts','Irrecoverable debts written off'],['professionalFees','Accountancy, legal and other professional fees'],['depreciation','Depreciation and loss or profit on sale of assets'],['otherExpenses','Other business expenses']
]
const ukPropertyFields=[
 ['rents','Rental Income'],['leasePremiums','Premiums of Lease Grant'],['reversePremiums','Reverse Premiums'],['otherIncome','Other Property Income'],['ukTaxDeducted','UK Tax Deducted'],['rentARoomReceived','Rent a Room Received'],['premisesCosts','Premises Running Costs'],['repairsMaintenance','Repairs and Maintenance'],['financialCosts','Financial Costs'],['professionalFees','Professional Fees'],['travelCosts','Travel Costs'],['costOfServices','Cost of Services'],['otherExpenses','Other Costs'],['rentARoomRelief','Rent a Room Relief'],['residentialFinancialCost','Residential Financial Cost'],['carryForwardResidentialFinanceCost','Carry Forward Residential Finance Cost']
]
const foreignPropertyFields=[
 ['rents','Total Rents and Other Receipts'],['leasePremiums','Premiums of Lease Grant'],['otherIncome','Other Foreign Property Income'],['premisesCosts','Rent, Rates, Insurance and Ground Rents'],['repairsMaintenance','Property Repairs and Maintenance'],['financialCosts','Property Finance Costs'],['professionalFees','Legal, Management and Professional Fees'],['costOfServices','Costs of Services Provided'],['travelCosts','Travel Expenses'],['otherExpenses','Other Allowable Foreign Property Expenses']
]

const laneMeta:Record<MtdIncomeSourceType,{eyebrow:string;label:string;description:string;action:string}>={
 'self-employment':{eyebrow:'Self Assessment',label:'Self Employment',description:'Sole trader and self employment cumulative quarterly updates.',action:'Open self employment'},
 'uk-property':{eyebrow:'Property owner submission',label:'UK Property',description:'Separate UK property cumulative quarterly filing.',action:'Open UK property'},
 'foreign-property':{eyebrow:'Property owner submission',label:'Foreign Property',description:'Separate foreign property cumulative quarterly filing.',action:'Open foreign property'}
}

export default async function SubmissionCentre({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<Record<string,string|undefined>>}){
 const {id}=await params;const qs=await searchParams;const db=supabaseAdmin();const workspace=await currentWorkspace();const firmId=workspace?.firmId||''
 const [{data:taxpayer},{data:businesses},{data:obligations}]=await Promise.all([
  firmId?db.from('taxpayers').select('*').eq('id',id).eq('firm_id',firmId).maybeSingle():Promise.resolve({data:null} as any),
  firmId?db.from('hmrc_businesses').select('*').eq('taxpayer_id',id).eq('firm_id',firmId).order('created_at'):Promise.resolve({data:[]} as any),
  firmId?db.from('hmrc_obligations').select('*').eq('taxpayer_id',id).eq('firm_id',firmId).gte('period_start','2025-04-06').order('period_end'):Promise.resolve({data:[]} as any)
 ])
 const sourceMap=new Map<string,any>()
 for(const business of businesses||[])if(business.business_id)sourceMap.set(business.business_id,{...business,sourceType:incomeSourceType(business),fallback:false})
 for(const obligation of obligations||[]){const businessId=String(obligation.business_id||'').trim();if(businessId&&!sourceMap.has(businessId))sourceMap.set(businessId,{business_id:businessId,business_name:null,sourceType:incomeSourceTypeFromBusinessId(businessId),fallback:true})}
 const sources=Array.from(sourceMap.values())
 const canonicalRequestedType=qs.type==='property'?'uk-property':qs.type
 const requestedType=(['self-employment','uk-property','foreign-property'].includes(String(canonicalRequestedType))?canonicalRequestedType:'self-employment') as MtdIncomeSourceType
 const availableTypes=(['self-employment','uk-property','foreign-property'] as MtdIncomeSourceType[]).filter(sourceType=>sources.some(source=>source.sourceType===sourceType))
 const type=(availableTypes.includes(requestedType)?requestedType:availableTypes[0]||requestedType) as MtdIncomeSourceType
 const matchingSources=sources.filter(source=>source.sourceType===type)
 const imported=decode(qs.imported)
 const fields=type==='foreign-property'?foreignPropertyFields:type==='uk-property'?ukPropertyFields:selfFields
 const selectedBusinessId=qs.businessId||matchingSources[0]?.business_id||''
 const selectedBusiness=matchingSources.find(source=>source.business_id===selectedBusinessId)||matchingSources[0]
 const businessPeriods=(obligations||[]).filter((o:any)=>!o.business_id||o.business_id===selectedBusiness?.business_id)
 const openPeriods=businessPeriods.filter((o:any)=>String(o.status).toLowerCase()==='open')
 const selectedPeriodEnd=qs.periodEnd||openPeriods[0]?.period_end||''
 const selectedPeriod=openPeriods.find((o:any)=>o.period_end===selectedPeriodEnd)||openPeriods[0]
 const quarterNumber=(o:any)=>Math.max(1,businessPeriods.findIndex((p:any)=>p.id===o.id)+1)
 const meta=laneMeta[type]
 const importedQuery=qs.imported?`&imported=${encodeURIComponent(qs.imported)}`:''
 return <div className="shell"><TaxpayerSidebar taxpayerId={id} active="submissions" sourceTypes={availableTypes}/><main className="main">
  <div className="top"><div><h1 className="pageTitle">Submission Centre</h1><p className="muted">Prepare cumulative MTD figures in separate income source lanes or import an MTD Lab Excel template.</p></div><span className="badge">{taxpayer?.display_name||id}</span></div>
  <div className="cards">{availableTypes.length?availableTypes.map(laneType=>{const lane=laneMeta[laneType];return <div className="card" key={laneType}><span className="eyebrow">{lane.eyebrow}</span><strong className="dateValue">{lane.label}</strong><p className="muted">{lane.description}</p><Link className="btn btnSmall" href={`/taxpayers/${id}/submissions?type=${laneType}`}>{lane.action}</Link></div>}):<div className="card"><span className="eyebrow">Income sources</span><strong>No HMRC source available</strong><p className="muted">Synchronise HMRC before preparing a quarterly update.</p></div>}</div>
  {qs.error&&<div className="status statusError">{qs.error}</div>}{qs.uploaded&&<div className="status"><strong>Template imported.</strong> Review the figures and choose the HMRC quarter below.</div>}
  <section className="panel"><div className="sectionHead"><div><h2>{meta.label} Submission</h2><p className="muted">Figures are submitted cumulatively from the beginning of the tax year to the selected period end. Future quarters can be prepared and reviewed before HMRC submission becomes eligible.</p></div><a className="btn btnSmall" href={`/api/templates/${type}`}>Download Excel template</a></div>
   <form method="post" action="/api/templates/upload" encType="multipart/form-data" style={{margin:'14px 0 22px'}}><input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="type" value={type}/><label><strong>Upload completed template</strong></label><div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginTop:8}}><input className="field" style={{maxWidth:430,margin:0}} type="file" name="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required/><button className="btn btnSmall" type="submit">Upload and import</button></div></form>
   <form method="get" style={{margin:'0 0 18px',display:'grid',gridTemplateColumns:'minmax(220px,420px) auto',gap:8,alignItems:'end'}}>
    <input type="hidden" name="type" value={type}/>
    <input type="hidden" name="businessId" value={selectedBusiness?.business_id||''}/>
    {qs.imported&&<input type="hidden" name="imported" value={qs.imported}/>}
    <label><strong>Quarter to prepare</strong>{openPeriods.length?<select className="selectField" name="periodEnd" defaultValue={selectedPeriod?.period_end||''} style={{marginTop:8}}>{openPeriods.map((o:any)=><option key={o.id} value={o.period_end}>Quarter {quarterNumber(o)}, to {fmtDate(o.period_end)}</option>)}</select>:<div className="status statusError">No open modern MTD obligation is available for this income source.</div>}</label>
    {openPeriods.length?<button className="btn btnSmall" type="submit">Apply</button>:null}
   </form>
   <form method="post" action="/api/hmrc/quarterly/prepare">
    <input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="incomeSourceType" value={type}/><input type="hidden" name="businessId" value={selectedBusiness?.business_id||''}/><input type="hidden" name="periodStart" value={selectedPeriod?.period_start||''}/><input type="hidden" name="periodEnd" value={selectedPeriod?.period_end||''}/>
    <div className="detailGrid"><div><span className="eyebrow">Income source</span><strong>{selectedBusiness?.business_name||meta.label}</strong><div className="mono muted">{selectedBusiness?.business_id||'No matching HMRC income source'}</div>{selectedBusiness?.fallback&&<div className="muted">Identified from HMRC obligations</div>}</div><div><span className="eyebrow">Selected cumulative period</span><strong>{selectedPeriod?`${fmtDate(selectedPeriod.period_start)} to ${fmtDate(selectedPeriod.period_end)}`:'No open period'}</strong><div className="muted">{selectedPeriod?.due_date?`Due ${fmtDate(selectedPeriod.due_date)}`:''}</div></div></div>
    {matchingSources.length>1&&<div style={{marginBottom:14}}><label><strong>Income source</strong></label><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>{matchingSources.map(source=><Link className="btn btnSmall" key={source.business_id} href={`/taxpayers/${id}/submissions?type=${type}&businessId=${encodeURIComponent(source.business_id)}${importedQuery}`}>{source.business_name||source.business_id}</Link>)}</div></div>}
    <div className="tableWrap"><table><thead><tr><th>Account name</th><th>Total amount (£)</th>{type==='self-employment'&&<th>Disallowable amount (£)</th>}</tr></thead><tbody>{fields.map(([key,label])=><tr key={key}><td>{label}</td><td><input className="field" style={{margin:0,maxWidth:220}} type="number" min="0" step="0.01" name={key} defaultValue={n(imported[key])}/></td>{type==='self-employment'&&<td>{['turnover','otherIncome','taxTakenOff'].includes(key)?<span className="muted">Not applicable</span>:<input className="field" style={{margin:0,maxWidth:220}} type="number" min="0" step="0.01" name={`${key}Disallowable`} defaultValue={n(imported[`${key}Disallowable`])}/>}</td>}</tr>)}</tbody></table></div>
    <div style={{display:'flex',gap:10,marginTop:18,flexWrap:'wrap'}}><button className="btn" type="submit" disabled={!selectedBusiness||!selectedPeriod}>Review {meta.label} update</button><Link className="btn btnSmall" href={`/taxpayers/${id}/quarterly?businessId=${encodeURIComponent(selectedBusiness?.business_id||'')}&sourceType=${encodeURIComponent(type)}`}>View obligations</Link></div>
   </form>
  </section>
 </main></div>
}
