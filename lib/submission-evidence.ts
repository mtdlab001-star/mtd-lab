function sumAmounts(value:unknown){
 if(!value||typeof value!=='object')return 0
 return Object.values(value).reduce((total,amount)=>total+(typeof amount==='number'&&Number.isFinite(amount)?amount:0),0)
}

export function quarterlyFinancials(row:any){
 const outer=row?.payload||row?.request_payload||row?.raw||{}
 const payload=outer.payload||outer
 const property=payload.foreignProperty||payload.ukProperty
 const income=property?sumAmounts(property.income):sumAmounts(payload.periodIncome)
 const expenses=property?sumAmounts(property.expenses):sumAmounts(payload.periodExpenses)
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
