import { NextResponse } from 'next/server'
import { signReviewPayload } from '@/lib/review-token'
import { isSameOriginRequest } from '@/lib/request-security'

function money(value: FormDataEntryValue | null) {
  const n=Number(value||0)
  return Number.isFinite(n) ? Math.round(n*100)/100 : 0
}

const moneyFields=[
 'turnover','otherIncome','taxTakenOff','costOfGoods','cisPayments','staffCosts','travelCosts','premisesCosts','repairsMaintenance','officeCosts','advertisingCosts','businessEntertainment','interestLoans','financialCharges','badDebts','professionalFees','depreciation','otherExpenses',
 'costOfGoodsDisallowable','cisPaymentsDisallowable','staffCostsDisallowable','travelCostsDisallowable','premisesCostsDisallowable','repairsMaintenanceDisallowable','officeCostsDisallowable','advertisingCostsDisallowable','businessEntertainmentDisallowable','interestLoansDisallowable','financialChargesDisallowable','badDebtsDisallowable','professionalFeesDisallowable','depreciationDisallowable','otherExpensesDisallowable',
 'rentalIncome','rents','leasePremiums','reversePremiums','otherPropertyIncome','ukTaxDeducted','rentARoomReceived','premisesRunningCosts','financialCosts','costOfServices','otherCosts','rentARoomRelief','residentialFinancialCost','carryForwardResidentialFinanceCost','propertyExpenses'
]

const allowedIncomeSourceTypes=new Set(['self-employment','uk-property','foreign-property'])

export async function POST(req: Request) {
  if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
  const form=await req.formData()
  const taxpayerId=String(form.get('taxpayerId')||'demo')
  const requestedType=String(form.get('incomeSourceType')||form.get('filingType')||'self-employment')
  const incomeSourceType=allowedIncomeSourceTypes.has(requestedType)?requestedType:'self-employment'
  const payload:any={
    taxpayerId,
    incomeSourceType,
    filingType:incomeSourceType==='self-employment'?'self-employment':'property',
    businessId:String(form.get('businessId')||''),
    periodStart:String(form.get('periodStart')||''),
    periodEnd:String(form.get('periodEnd')||''),
    preparedAt:new Date().toISOString()
  }
  for(const key of moneyFields) payload[key]=money(form.get(key))
  const token=signReviewPayload(payload)
  return NextResponse.redirect(new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/quarterly/review?data=${encodeURIComponent(token)}`,req.url),303)
}
