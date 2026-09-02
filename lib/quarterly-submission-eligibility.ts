export type QuarterlySourceType='self-employment'|'uk-property'|'foreign-property'

type EligibilityInput={
  taxpayerId:string
  businessId:string
  periodStart:string
  periodEnd:string
  requestedType:string
  business?:any|null
  obligations?:any[]|null
  submissions?:any[]|null
  currentDate?:string
  allowFuturePeriod?:boolean
}

export type QuarterlyEligibility=
  | {ok:true;sourceType:QuarterlySourceType;obligation:any}
  | {ok:false;error:string}

export function normaliseQuarterlySourceType(value:string):QuarterlySourceType|null{
  if(value==='property')return 'uk-property'
  if(value==='self-employment'||value==='uk-property'||value==='foreign-property')return value
  return null
}

export function quarterlyPeriodIsAvailable(periodEnd:string,currentDate=new Date().toISOString().slice(0,10)){
  return Boolean(periodEnd&&/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)&&/^\d{4}-\d{2}-\d{2}$/.test(currentDate)&&periodEnd<currentDate)
}

function storedBusinessSourceType(business:any):QuarterlySourceType{
  const type=String(business?.business_type||'').toLowerCase()
  const raw=JSON.stringify(business?.raw||{}).toLowerCase()
  if(type.includes('foreign')||raw.includes('foreign-property')||raw.includes('foreign property'))return 'foreign-property'
  if(type.includes('property')||raw.includes('uk-property')||raw.includes('uk property')||raw.includes('property'))return 'uk-property'
  return 'self-employment'
}

export function quarterlySubmissionEligibility(input:EligibilityInput):QuarterlyEligibility{
  const sourceType=normaliseQuarterlySourceType(input.requestedType)
  if(!sourceType)return {ok:false,error:'Select a valid HMRC income source type before submission'}

  const obligations=input.obligations||[]
  const submissions=input.submissions||[]
  const businessMatches=Boolean(input.business&&String(input.business.business_id||'')===input.businessId)
  const exactObligationSource=obligations.some((o:any)=>String(o.business_id||'')===input.businessId)
  if(!businessMatches&&!exactObligationSource)return {ok:false,error:'Select a valid HMRC business before submission'}

  if(businessMatches&&storedBusinessSourceType(input.business)!==sourceType){
    return {ok:false,error:'The selected income source type does not match the HMRC business'}
  }

  if(!input.allowFuturePeriod&&!quarterlyPeriodIsAvailable(input.periodEnd,input.currentDate)){
    return {ok:false,error:`This quarterly update cannot be submitted until the period ending ${input.periodEnd} has fully ended`}
  }

  const duplicate=submissions.some((s:any)=>{
    const status=String(s.status||'').toLowerCase()
    return s.taxpayer_id===input.taxpayerId&&
      s.business_id===input.businessId&&
      s.period_start===input.periodStart&&
      s.period_end===input.periodEnd&&
      (status==='sending'||status==='submitted')
  })
  if(duplicate)return {ok:false,error:'This cumulative quarterly period has already been submitted or is currently being sent'}

  const obligation=obligations.find((o:any)=>
    o.taxpayer_id===input.taxpayerId&&
    o.period_start===input.periodStart&&
    o.period_end===input.periodEnd&&
    (!o.business_id||o.business_id===input.businessId)&&
    String(o.status||'').toLowerCase()==='open'
  )
  if(!obligation)return {ok:false,error:'No open eligible HMRC obligation matches this business and period'}

  return {ok:true,sourceType,obligation}
}
