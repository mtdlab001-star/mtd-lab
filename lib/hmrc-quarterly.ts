export function taxYearFromDate(value:string){
  const [y,m,d]=value.split('-').map(Number)
  if(!y||!m||!d) throw new Error('Invalid period start date')
  const start=m>4||(m===4&&d>=6)?y:y-1
  return `${start}-${String(start+1).slice(-2)}`
}

export function buildSelfEmploymentCumulativePayload(p:any){
  return {
    periodDates:{
      periodStartDate:p.periodStart,
      periodEndDate:p.periodEnd
    },
    periodIncome:{
      turnover:Number(p.turnover||0),
      other:Number(p.otherIncome||0)
    },
    periodExpenses:{
      costOfGoods:Number(p.costOfGoods||0),
      wagesAndStaffCosts:Number(p.staffCosts||0),
      carVanTravelExpenses:Number(p.travelCosts||0),
      premisesRunningCosts:Number(p.premisesCosts||0),
      professionalFees:Number(p.professionalFees||0),
      otherExpenses:Number(p.otherExpenses||0)
    }
  }
}

export function cumulativeEndpoint(nino:string,businessId:string,taxYear:string){
  return `/individuals/business/self-employment/${encodeURIComponent(nino)}/${encodeURIComponent(businessId)}/cumulative/${encodeURIComponent(taxYear)}`
}
