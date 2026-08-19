import { NextResponse } from 'next/server'
import { signReviewPayload } from '@/lib/review-token'

function money(value: FormDataEntryValue | null) {
  const n=Number(value||0)
  return Number.isFinite(n) ? Math.round(n*100)/100 : 0
}

const moneyFields=[
 'turnover','otherIncome','taxTakenOff','costOfGoods','cisPayments','staffCosts','travelCosts','premisesCosts','repairsMaintenance','officeCosts','advertisingCosts','businessEntertainment','interestLoans','financialCharges','badDebts','professionalFees','depreciation','otherExpenses',
 'costOfGoodsDisallowable','cisPaymentsDisallowable','staffCostsDisallowable','travelCostsDisallowable','premisesCostsDisallowable','repairsMaintenanceDisallowable','officeCostsDisallowable','advertisingCostsDisallowable','businessEntertainmentDisallowable','interestLoansDisallowable','financialChargesDisallowable','badDebtsDisallowable','professionalFeesDisallowable','depreciationDisallowable','otherExpensesDisallowable',
 'rentalIncome','leasePremiums','reversePremiums','otherPropertyIncome','ukTaxDeducted','rentARoomReceived','premisesRunningCosts','financialCosts','costOfServices','otherCosts','rentARoomRelief','residentialFinancialCost','carryForwardResidentialFinanceCost'
]

export async function POST(req: Request) {
  const form=await req.formData()
  const taxpayerId=String(form.get('taxpayerId')||'demo')
  const filingType=String(form.get('filingType')||'self-employment')==='property'?'property':'self-employment'
  const payload:any={
    taxpayerId,
    filingType,
    businessId:String(form.get('businessId')||''),
    periodStart:String(form.get('periodStart')||''),
    periodEnd:String(form.get('periodEnd')||''),
    preparedAt:new Date().toISOString()
  }
  for(const key of moneyFields) payload[key]=money(form.get(key))
  const token=signReviewPayload(payload)
  return NextResponse.redirect(new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/quarterly/review?data=${encodeURIComponent(token)}`,req.url),303)
}
