const isLive = process.env.HMRC_ENVIRONMENT === 'production'
export const hmrcApiBase = isLive ? 'https://api.service.hmrc.gov.uk' : 'https://test-api.service.hmrc.gov.uk'
export const hmrcWebBase = isLive ? 'https://www.tax.service.gov.uk' : 'https://test-www.tax.service.gov.uk'

type HmrcToken = { access_token: string; refresh_token?: string; expires_in: number; token_type: string; scope?: string }

async function tokenRequest(body: URLSearchParams) {
  const res = await fetch(`${hmrcApiBase}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store'
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.error || 'HMRC token request failed')
  return data as HmrcToken
}

export async function exchangeCode(code: string) {
  return tokenRequest(new URLSearchParams({
    client_id: process.env.HMRC_CLIENT_ID || '',
    client_secret: process.env.HMRC_CLIENT_SECRET || '',
    grant_type: 'authorization_code',
    redirect_uri: process.env.HMRC_REDIRECT_URI || '',
    code
  }))
}

export async function refreshAccessToken(refreshToken: string) {
  return tokenRequest(new URLSearchParams({
    client_id: process.env.HMRC_CLIENT_ID || '',
    client_secret: process.env.HMRC_CLIENT_SECRET || '',
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  }))
}

export async function hmrcGet(path: string, accessToken: string, accept: string, sandboxScenario?: string) {
  const scenario = sandboxScenario || process.env.HMRC_TEST_SCENARIO || 'DEFAULT'
  const res = await fetch(`${hmrcApiBase}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: accept,
      ...(isLive ? {} : { 'Gov-Test-Scenario': scenario })
    },
    cache: 'no-store'
  })
  const text = await res.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) throw new Error(`HMRC ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`)
  return data
}
