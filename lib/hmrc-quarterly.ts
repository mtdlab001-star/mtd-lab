export function taxYearFromDate(value:string){
  const [y,m,d]=value.split('-').map(Number)
  if(!y||!m||!d) throw new Error('Invalid period start date')
  const start=m>4||(m===4&&d>=6)?y:y-1
  return `${start}-${String(start+1).slice(-2)}`
}

const n=(v:any)=>Number(v||0)
const clean=(obj:Record<string,any>)=>Object.fromEntries(Object.entries(obj).filter(([,v])=>v!==undefined&&v!==null))

export function buildSelfEmploymentCumulativePayload(p:any){
  return {
    periodDates:{periodStartDate:p.periodStart,periodEndDate:p.periodEnd},
    periodIncome:clean({
      turnover:n(p.turnover),
      other:n(p.otherIncome),
      taxTakenOffTradingIncome:n(p.taxTakenOff)
    }),
    periodExpenses:clean({
      costOfGoods:n(p.costOfGoods),
      paymentsToSubcontractors:n(p.cisPayments),
      wagesAndStaffCosts:n(p.staffCosts),
      carVanTravelExpenses:n(p.travelCosts),
      premisesRunningCosts:n(p.premisesCosts),
      maintenanceCosts:n(p.repairsMaintenance),
      adminCosts:n(p.officeCosts),
      businessEntertainmentCosts:n(p.businessEntertainment),
      advertisingCosts:n(p.advertisingCosts),
      interestOnBankOtherLoans:n(p.interestLoans),
      financeCharges:n(p.financialCharges),
      irrecoverableDebts:n(p.badDebts),
      professionalFees:n(p.professionalFees),
      depreciation:n(p.depreciation),
      otherExpenses:n(p.otherExpenses)
    }),
    periodDisallowableExpenses:clean({
      costOfGoodsDisallowable:n(p.costOfGoodsDisallowable),
      paymentsToSubcontractorsDisallowable:n(p.cisPaymentsDisallowable),
      wagesAndStaffCostsDisallowable:n(p.staffCostsDisallowable),
      carVanTravelExpensesDisallowable:n(p.travelCostsDisallowable),
      premisesRunningCostsDisallowable:n(p.premisesCostsDisallowable),
      maintenanceCostsDisallowable:n(p.repairsMaintenanceDisallowable),
      adminCostsDisallowable:n(p.officeCostsDisallowable),
      businessEntertainmentCostsDisallowable:n(p.businessEntertainmentDisallowable),
      advertisingCostsDisallowable:n(p.advertisingCostsDisallowable),
      interestOnBankOtherLoansDisallowable:n(p.interestLoansDisallowable),
      financeChargesDisallowable:n(p.financialChargesDisallowable),
      irrecoverableDebtsDisallowable:n(p.badDebtsDisallowable),
      professionalFeesDisallowable:n(p.professionalFeesDisallowable),
      depreciationDisallowable:n(p.depreciationDisallowable),
      otherExpensesDisallowable:n(p.otherExpensesDisallowable)
    })
  }
}

export function buildUkPropertyCumulativePayload(p:any){
  return {
    fromDate:p.periodStart,
    toDate:p.periodEnd,
    ukProperty:{
      income:{
        premiumsOfLeaseGrant:n(p.leasePremiums),
        reversePremiums:n(p.reversePremiums),
        periodAmount:n(p.rentalIncome),
        taxDeducted:n(p.ukTaxDeducted),
        otherIncome:n(p.otherPropertyIncome),
        rentARoom:{rentsReceived:n(p.rentARoomReceived)}
      },
      expenses:{
        premisesRunningCosts:n(p.premisesRunningCosts),
        repairsAndMaintenance:n(p.repairsMaintenance),
        financialCosts:n(p.financialCosts),
        professionalFees:n(p.professionalFees),
        costOfServices:n(p.costOfServices),
        other:n(p.otherCosts),
        residentialFinancialCost:n(p.residentialFinancialCost),
        travelCosts:n(p.travelCosts),
        residentialFinancialCostsCarriedForward:n(p.carryForwardResidentialFinanceCost),
        rentARoom:{amountClaimed:n(p.rentARoomRelief)}
      }
    }
  }
}

export function cumulativeEndpoint(nino:string,businessId:string,taxYear:string){
  return `/individuals/business/self-employment/${encodeURIComponent(nino)}/${encodeURIComponent(businessId)}/cumulative/${encodeURIComponent(taxYear)}`
}

export function ukPropertyCumulativeEndpoint(nino:string,businessId:string,taxYear:string){
  return `/individuals/business/property/uk/${encodeURIComponent(nino)}/${encodeURIComponent(businessId)}/cumulative/${encodeURIComponent(taxYear)}`
}
