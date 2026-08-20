export const HMRC_API_VERSIONS = {
  selfEmploymentBusiness: '5.0',
  propertyBusiness: '6.0',
  businessDetails: '2.0',
  obligations: '3.0',
  individualCalculations: '8.0',
} as const

export type HmrcApiName = keyof typeof HMRC_API_VERSIONS

export function hmrcAcceptHeader(api: HmrcApiName) {
  return `application/vnd.hmrc.${HMRC_API_VERSIONS[api]}+json`
}

export function hmrcApiVersionSnapshot() {
  return Object.entries(HMRC_API_VERSIONS).map(([api, version]) => ({ api, version }))
}
