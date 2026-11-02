export function productionSubmissionBlocker() {
  if (process.env.HMRC_ENVIRONMENT !== 'production') return null
  if (process.env.HMRC_PRODUCTION_CREDENTIALS_APPROVED !== 'true') {
    return 'Production filing is locked until formal HMRC production credential approval is recorded.'
  }
  if (process.env.HMRC_ALLOW_PRODUCTION_SUBMISSIONS !== 'true') {
    return 'Production filing is locked until the release switch is explicitly enabled.'
  }
  return null
}

export function productionSubmissionStatus() {
  const blocker = productionSubmissionBlocker()
  return { allowed: !blocker, blocker }
}
