import { NextResponse } from 'next/server'
import { signReviewPayload } from '@/lib/review-token'
import { isSameOriginRequest } from '@/lib/request-security'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { quarterlySubmissionEligibility } from '@/lib/quarterly-submission-eligibility'
import { currentWorkspace } from '@/lib/workspace'

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
  const workspace=await currentWorkspace();if(!workspace)return new NextResponse('Accounting workspace access is not available',{status:403})
  const form=await req.formData()
  const taxpayerId=String(form.get('taxpayerId')||'demo')
  const requestedType=String(form.get('incomeSourceType')||form.get('filingType')||'self-employment')
  const incomeSourceType=allowedIncomeSourceTypes.has(requestedType)?requestedType:'self-employment'
  const businessId=String(form.get('businessId')||'')
  const periodStart=String(form.get('periodStart')||'')
  const periodEnd=String(form.get('periodEnd')||'')
  const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/quarterly`,req.url)
  back.searchParams.set('businessId',businessId)
  back.searchParams.set('sourceType',incomeSourceType)

  const db=supabaseAdmin()
  const [taxpayerResult,businessResult,obligationResult,submissionResult]=await Promise.all([
    db.from('taxpayers').select('id').eq('id',taxpayerId).eq('firm_id',workspace.firmId).maybeSingle(),
    db.from('hmrc_businesses').select('business_id,business_type,raw').eq('firm_id',workspace.firmId).eq('taxpayer_id',taxpayerId).eq('business_id',businessId).maybeSingle(),
    db.from('hmrc_obligations').select('taxpayer_id,business_id,period_start,period_end,status').eq('firm_id',workspace.firmId).eq('taxpayer_id',taxpayerId).eq('period_start',periodStart).eq('period_end',periodEnd),
    db.from('hmrc_quarterly_submissions').select('taxpayer_id,business_id,period_start,period_end,status').eq('firm_id',workspace.firmId).eq('taxpayer_id',taxpayerId).eq('business_id',businessId).eq('period_start',periodStart).eq('period_end',periodEnd).in('status',['sending','submitted'])
  ])
  if(taxpayerResult.error||businessResult.error||obligationResult.error||submissionResult.error){
    back.searchParams.set('error','Quarterly preparation checks are temporarily unavailable')
    return NextResponse.redirect(back,303)
  }
  if(!taxpayerResult.data){
    back.searchParams.set('error','Taxpayer is not available in this accounting workspace')
    return NextResponse.redirect(back,303)
  }
  const eligibility=quarterlySubmissionEligibility({taxpayerId,businessId,periodStart,periodEnd,requestedType:incomeSourceType,business:businessResult.data,obligations:obligationResult.data,submissions:submissionResult.data,allowFuturePeriod:true})
  if(!eligibility.ok){back.searchParams.set('error',eligibility.error);return NextResponse.redirect(back,303)}
  const payload:any={
    taxpayerId,
    incomeSourceType:eligibility.sourceType,
    filingType:eligibility.sourceType==='self-employment'?'self-employment':'property',
    businessId,
    periodStart,
    periodEnd,
    preparedAt:new Date().toISOString()
  }
  for(const key of moneyFields) payload[key]=money(form.get(key))

  const now=new Date().toISOString()
  const {error:draftError}=await db.from('hmrc_quarterly_drafts').upsert({
    firm_id:workspace.firmId,
    taxpayer_id:taxpayerId,
    business_id:businessId,
    income_source_type:eligibility.sourceType,
    period_start:periodStart,
    period_end:periodEnd,
    figures:payload,
    updated_at:now
  },{onConflict:'firm_id,taxpayer_id,business_id,income_source_type,period_end'})
  if(draftError){
    console.error('Unable to save quarterly draft',draftError)
    back.searchParams.set('error','Quarterly draft could not be saved')
    return NextResponse.redirect(back,303)
  }

  const token=signReviewPayload(payload)
  return NextResponse.redirect(new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/quarterly/review?data=${encodeURIComponent(token)}`,req.url),303)
}
