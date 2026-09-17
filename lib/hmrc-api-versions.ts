export const HMRC_API_VERSIONS = {
  selfEmploymentBusiness: '5.0',
  propertyBusiness: '6.0',
  businessDetails: '2.0',
  obligations: '3.0',
  individualCalculations: '8.0',
  reliefs: '3.0',
  bsas: '7.0',
  losses: '7.0',
  employments: '2.0',
  stateBenefits: '2.0',
  taxLiabilityAdjustments: '1.0',
  otherIncome: '2.0',
  agentAuthorisation: '2.0',
  agentClientRelationships: '1.0',
  testSupport: '1.0',
  testUsers: '1.0',
} as const

export type HmrcApiName = keyof typeof HMRC_API_VERSIONS

export function hmrcAcceptHeader(api: HmrcApiName) {
  return `application/vnd.hmrc.${HMRC_API_VERSIONS[api]}+json`
}

export function hmrcOtherIncomeAcceptHeader(taxYear: string) {
  if (Number(taxYear.slice(0, 4)) >= 2026) {
    if (process.env.HMRC_ENVIRONMENT === 'production') throw new Error('Other Income v3 is currently sandbox only.')
    if (process.env.HMRC_OTHER_INCOME_V3_ENABLED !== 'true') throw new Error('Other Income v3 sandbox testing is not enabled.')
    return 'application/vnd.hmrc.3.0+json'
  }
  return hmrcAcceptHeader('otherIncome')
}

export function hmrcApiVersionSnapshot() {
  return Object.entries(HMRC_API_VERSIONS).map(([api, version]) => ({ api, version,
    ...(api === 'otherIncome' ? { sandboxCandidate: '3.0', sandboxCandidateEnabled: process.env.HMRC_ENVIRONMENT !== 'production' && process.env.HMRC_OTHER_INCOME_V3_ENABLED === 'true' } : {}),
    ...(api === 'individualCalculations' ? { sandboxCandidate: '9.0', sandboxCandidateEnabled: false } : {}),
  }))
}
