export type MtdIncomeSourceType = 'self-employment' | 'uk-property' | 'foreign-property'

export function incomeSourceType(b: any): MtdIncomeSourceType {
  const t = String(b?.business_type || '').toLowerCase()
  const raw = JSON.stringify(b?.raw || {}).toLowerCase()
  if (t.includes('foreign') || raw.includes('foreign-property') || raw.includes('foreign property')) return 'foreign-property'
  if (t.includes('property') || raw.includes('uk-property') || raw.includes('uk property') || raw.includes('property')) return 'uk-property'
  return 'self-employment'
}

export function incomeSourceLabel(b: any) {
  const type = incomeSourceType(b)
  if (type === 'foreign-property') return 'Foreign Property'
  if (type === 'uk-property') return 'UK Property'
  return 'Self Employment'
}

export function isPropertyIncomeSource(b: any) {
  return incomeSourceType(b) !== 'self-employment'
}

export function isForeignPropertyIncomeSource(b: any) {
  return incomeSourceType(b) === 'foreign-property'
}

function firstDate(raw:any, keys:string[]){for(const key of keys){const value=raw?.[key];if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value))return value}return null}

export function incomeSourceStartDate(b:any){
  const raw=b?.raw||{}
  return firstDate(raw,['commencementDate','startDate','businessStartDate','incomeSourceStartDate'])
}

export function incomeSourceCessationDate(b:any){
  const raw=b?.raw||{}
  return firstDate(raw,['cessationDate','endDate','businessEndDate','incomeSourceEndDate'])
}

export function incomeSourceStatus(b: any) {
  return incomeSourceCessationDate(b) ? 'Inactive' : 'Active'
}

export function incomeSourceLifecycleLabel(b:any){
  const start=incomeSourceStartDate(b)
  const end=incomeSourceCessationDate(b)
  if(end)return `Ceased ${end}`
  if(start)return `Started ${start}`
  return 'Lifecycle date not supplied by HMRC'
}
