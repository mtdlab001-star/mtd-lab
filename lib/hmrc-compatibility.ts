// Release baseline: HMRC Income Tax MTD changelog, 14 to 16 September 2026.
export function validAnnualTaxYear(taxYear: string) {
  const match = /^(20\d{2})-(\d{2})$/.exec(taxYear)
  return Boolean(match && Number(match[1]) >= 2026 && String(Number(match[1]) + 1).slice(-2) === match[2])
}

export function compatibilityAmount(value: unknown, label: string): number | undefined {
  const raw = String(value ?? '').trim()
  if (!raw) return undefined
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error(`${label} must be a nonnegative amount with at most two decimal places.`)
  const amount = Number(raw)
  if (!Number.isFinite(amount) || amount > 99999999999.99) throw new Error(`${label} exceeds the HMRC amount limit.`)
  return amount
}

export function assertSandboxFeature(feature: string, supplied: boolean, environment = process.env.HMRC_ENVIRONMENT) {
  if (supplied && environment === 'production') throw new Error(`${feature} is currently available for HMRC sandbox testing only.`)
}

export function annualCompatibilityPatch(source: string, taxYear: string, class4: unknown, allowance: unknown) {
  if (!validAnnualTaxYear(taxYear)) throw new Error('Select a consecutive tax year from 2026 to 2027 onwards.')
  if (!['self-employment', 'uk-property'].includes(source)) throw new Error('These annual compatibility fields apply only to Self Employment and UK Property.')
  const adjustment = compatibilityAmount(class4, 'Class 4 profit adjustment')
  const firstYearAllowance = compatibilityAmount(allowance, 'Plant and machinery allowance')
  if (source !== 'self-employment' && adjustment !== undefined) throw new Error('Class 4 profit adjustment is only available for Self Employment.')
  if (adjustment === undefined && firstYearAllowance === undefined) throw new Error('Enter at least one annual adjustment or allowance.')
  const patch: Record<string, Record<string, number>> = {}
  if (adjustment !== undefined) patch.adjustments = { adjustmentToProfitsForClass4: adjustment }
  if (firstYearAllowance !== undefined) patch.allowances = { firstYearAllowanceOnPlantAndMachinery: firstYearAllowance }
  return source === 'uk-property' ? { ukProperty: patch } : patch
}

export function annualEndpoint(source: string, nino: string, businessId: string, taxYear: string) {
  if (!['self-employment', 'uk-property'].includes(source)) throw new Error('Unsupported annual source.')
  const prefix = source === 'uk-property' ? 'property/uk' : 'self-employment'
  return `/individuals/business/${prefix}/${encodeURIComponent(nino)}/${encodeURIComponent(businessId)}/annual/${encodeURIComponent(taxYear)}`
}

// Annual PUT replaces the resource. Preserve every existing section rather than sending only the new fields.
export function mergeAnnualCompatibility(existing: any, patch: any, source: string) {
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) throw new Error('HMRC annual data could not be safely read.')
  const base = source === 'uk-property' ? existing.ukProperty || {} : existing
  const changes = source === 'uk-property' ? patch.ukProperty : patch
  if (!base || typeof base !== 'object' || Array.isArray(base)) throw new Error('HMRC annual data could not be safely read.')
  for (const section of ['adjustments', 'allowances']) {
    if (base[section] !== undefined && (!base[section] || typeof base[section] !== 'object' || Array.isArray(base[section]))) throw new Error('HMRC annual data could not be safely read.')
  }
  const allowanceKey = source === 'uk-property' ? 'propertyIncomeAllowance' : 'tradingIncomeAllowance'
  if (changes.allowances && Object.hasOwn(base.allowances || {}, allowanceKey)) throw new Error('The existing income allowance cannot be combined with plant and machinery allowances. Review the full annual submission first.')
  const result = { ...base }
  for (const section of ['adjustments', 'allowances']) {
    if (changes[section]) result[section] = { ...base[section], ...changes[section] }
  }
  return source === 'uk-property' ? { ...existing, ukProperty: result } : result
}

export function winterFuelPaymentCharge(result: any): number | null {
  const value = result?.calculation?.taxCalculation?.incomeTax?.winterFuelPaymentCharge
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
