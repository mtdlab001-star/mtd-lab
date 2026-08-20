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

export function incomeSourceStatus(b: any) {
  const raw = b?.raw || {}
  return raw.cessationDate || raw.endDate ? 'Inactive' : 'Active'
}
