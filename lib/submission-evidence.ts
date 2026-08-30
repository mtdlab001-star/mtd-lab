function sumAmounts(value:unknown){
 if(typeof value==='number')return Number.isFinite(value)?value:0
 if(!value||typeof value!=='object')return 0
 return Object.values(value).reduce((total,amount)=>total+sumAmounts(amount),0)
}

export function quarterlyFinancials(row:any){
 const outer=row?.payload||row?.request_payload||row?.raw||{}
 const payload=outer.payload||outer
 const propertyValue=payload.foreignProperty||payload.ukProperty
 const properties=propertyValue?(Array.isArray(propertyValue)?propertyValue:[propertyValue]):[]
 const income=properties.length?properties.reduce((total:number,property:any)=>total+sumAmounts(property?.income),0):sumAmounts(payload.periodIncome)
 const expenses=properties.length?properties.reduce((total:number,property:any)=>total+sumAmounts(property?.expenses),0):sumAmounts(payload.periodExpenses)
 return {income,expenses,net:income-expenses}
}

function money(value:number){
 return value.toLocaleString('en-GB',{style:'currency',currency:'GBP'})
}

export function quarterlyEvidenceDetail(row:any,incomeSourceLabel:string){
 const totals=quarterlyFinancials(row)
 const details=[
  incomeSourceLabel,
  `Income source ID ${row?.business_id||'Not available'}`,
  `Period ${row?.period_start||'Not available'} to ${row?.period_end||'Not available'}`,
  `Income ${money(totals.income)}`,
  `Expenses ${money(totals.expenses)}`,
  `Net ${money(totals.net)}`,
  `Submission ID ${row?.id||'Not available'}`,
 ]
 if(row?.hmrc_http_status)details.push(`HMRC HTTP ${row.hmrc_http_status}`)
 return details.join(' · ')
}
