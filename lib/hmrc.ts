const isLive = process.env.HMRC_ENVIRONMENT === 'production'
export const hmrcApiBase = isLive ? 'https://api.service.hmrc.gov.uk' : 'https://test-api.service.hmrc.gov.uk'
export const hmrcWebBase = isLive ? 'https://www.tax.service.gov.uk' : 'https://test-www.tax.service.gov.uk'

type HmrcToken = { access_token: string; refresh_token?: string; expires_in: number; token_type: string; scope?: string }

export class HmrcRequestError extends Error {
  status:number
  payload:any
  correlationId:string|null
  constructor(status:number,payload:any,correlationId:string|null){
    const detail=typeof payload==='string'?payload:(payload?.message||payload?.error_description||payload?.code||`HMRC request failed with status ${status}`)
    super(detail)
    this.name='HmrcRequestError'
    this.status=status
    this.payload=payload
    this.correlationId=correlationId
  }
}

async function tokenRequest(body: URLSearchParams) {
  const res = await fetch(`${hmrcApiBase}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store'
  })
  const text=await res.text()
  let data:any={}
  try{data=text?JSON.parse(text):{}}catch{data={message:text}}
  if (!res.ok) throw new HmrcRequestError(res.status,data,res.headers.get('x-correlationid')||res.headers.get('x-correlation-id'))
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

export async function hmrcGet(path: string, accessToken: string, accept: string, sandboxScenario?: string, extraHeaders:Record<string,string>={}) {
  const scenario = sandboxScenario || process.env.HMRC_TEST_SCENARIO || 'DEFAULT'
  const res = await fetch(`${hmrcApiBase}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: accept,
      ...(isLive ? {} : { 'Gov-Test-Scenario': scenario }),
      ...extraHeaders
    },
    cache: 'no-store'
  })
  const text = await res.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) throw new HmrcRequestError(res.status,data,res.headers.get('x-correlationid')||res.headers.get('x-correlation-id'))
  return data
}
