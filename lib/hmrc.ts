const isLive = process.env.HMRC_ENVIRONMENT === 'production'
export const hmrcApiBase = isLive ? 'https://api.service.hmrc.gov.uk' : 'https://test-api.service.hmrc.gov.uk'
export const hmrcWebBase = isLive ? 'https://www.tax.service.gov.uk' : 'https://test-www.tax.service.gov.uk'

export async function exchangeCode(code: string) {
  const body = new URLSearchParams({
    client_id: process.env.HMRC_CLIENT_ID || '',
    client_secret: process.env.HMRC_CLIENT_SECRET || '',
    grant_type: 'authorization_code',
    redirect_uri: process.env.HMRC_REDIRECT_URI || '',
    code
  })
  const res = await fetch(`${hmrcApiBase}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store'
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.error || 'HMRC token exchange failed')
  return data as { access_token: string; refresh_token: string; expires_in: number; token_type: string; scope?: string }
}

export async function hmrcGet(path: string, accessToken: string, accept: string) {
  const res = await fetch(`${hmrcApiBase}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: accept,
      ...(isLive ? {} : { 'Gov-Test-Scenario': 'DEFAULT' })
    },
    cache: 'no-store'
  })
  const text = await res.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) throw new Error(`HMRC ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`)
  return data
}
