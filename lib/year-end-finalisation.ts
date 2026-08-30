export const YEAR_END_REVIEW_SECTIONS = [
  'adjustments',
  'tax-liability',
  'reliefs',
  'other-income',
  'state-benefits',
  'employment',
] as const

type Obligation = {
  period_start?: string | null
  status?: string | null
}

type Review = {
  section?: string | null
  status?: string | null
}

export function taxYearFromDate(value:string){
  const [year,month,day]=String(value||'').split('-').map(Number)
  if(!Number.isFinite(year)||!Number.isFinite(month)||!Number.isFinite(day))return ''
  const start=month>4||(month===4&&day>=6)?year:year-1
  return `${start}-${String(start+1).slice(-2)}`
}

export function taxYearHasEnded(taxYear:string,now=new Date()){
  if(!/^20\d{2}-\d{2}$/.test(taxYear))return false
  const start=Number(taxYear.slice(0,4))
  return now.getTime()>=Date.UTC(start+1,3,6,0,0,0)
}

export function yearEndFinalisationStatus({
  taxYear,
  businessCount,
  obligations,
  reviews,
  now=new Date(),
}:{
  taxYear:string
  businessCount:number
  obligations:Obligation[]
  reviews:Review[]
  now?:Date
}){
  const yearObligations=obligations.filter(row=>taxYearFromDate(String(row.period_start||''))===taxYear)
  const openCount=yearObligations.filter(row=>String(row.status||'').toLowerCase()==='open').length
  const reviewMap=new Map(reviews.map(row=>[String(row.section||''),String(row.status||'')]))
  const completedReviewCount=YEAR_END_REVIEW_SECTIONS.filter(section=>
    ['reviewed','not_applicable'].includes(reviewMap.get(section)||'')
  ).length
  const ended=taxYearHasEnded(taxYear,now)
  const incomeSourcesReady=businessCount>0
  const quarterlyReady=yearObligations.length>0&&openCount===0
  const reviewComplete=completedReviewCount===YEAR_END_REVIEW_SECTIONS.length
  const blockers=[
    !ended?'Tax year has not ended':null,
    !incomeSourcesReady?'No HMRC income sources found':null,
    !quarterlyReady?'Open or missing quarterly obligations remain':null,
    !reviewComplete?'Year end schedules have not all been reviewed':null,
  ].filter((value):value is string=>Boolean(value))

  return {
    canFinalise:blockers.length===0,
    blockers,
    ended,
    incomeSourcesReady,
    quarterlyReady,
    reviewComplete,
    yearObligationCount:yearObligations.length,
    openCount,
    completedReviewCount,
  }
}
