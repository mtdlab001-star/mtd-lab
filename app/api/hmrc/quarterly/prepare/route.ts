import { NextResponse } from 'next/server'
import { signReviewPayload } from '@/lib/review-token'
import { isSameOriginRequest } from '@/lib/request-security'
import { supabaseAdmin } from '@/lib/supabase-admin'

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

  const db=supabaseAdmin()
  const {error:draftError}=await db.from('hmrc_quarterly_drafts').upsert({
    taxpayer_id:taxpayerId,
    business_id:payload.businessId,
    income_source_type:incomeSourceType,
    period_start:payload.periodStart,
    period_end:payload.periodEnd,
    figures:payload,
    updated_at:new Date().toISOString()
  },{onConflict:'taxpayer_id,business_id,income_source_type,period_end'})
  if(draftError){
    console.error('Unable to save quarterly draft',draftError)
    return new NextResponse('Unable to save quarterly draft',{status:500})
  }

  const token=signReviewPayload(payload)
  return NextResponse.redirect(new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/quarterly/review?data=${encodeURIComponent(token)}`,req.url),303)
}
