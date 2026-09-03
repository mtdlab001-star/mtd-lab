import { NextResponse } from 'next/server'
import { isSameOriginRequest } from '@/lib/request-security'
import { currentWorkspace } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

const sandboxApiBase='https://test-api.service.hmrc.gov.uk'

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) return new NextResponse('Invalid request origin', { status: 403 })
  const workspace=await currentWorkspace()
  if(!workspace)return NextResponse.json({error:'Accounting workspace access is not available.'},{status:403})

  if (process.env.HMRC_ENVIRONMENT === 'production') {
    return NextResponse.json({ error: 'Sandbox test user creation is disabled in production HMRC mode.' }, { status: 403 })
  }

  const clientId = process.env.HMRC_CLIENT_ID
  const clientSecret = process.env.HMRC_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'HMRC sandbox application credentials are not configured.' }, { status: 500 })
  }

  const tokenResponse = await fetch(`${sandboxApiBase}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }).toString(),
    cache: 'no-store',
  })

  const tokenText = await tokenResponse.text()
  let tokenData: any
  try { tokenData = tokenText ? JSON.parse(tokenText) : {} } catch { tokenData = { message: tokenText } }

  if (!tokenResponse.ok || !tokenData?.access_token) {
    return NextResponse.json({
      error: tokenData?.error_description || tokenData?.message || tokenData?.error || `HMRC application token request returned ${tokenResponse.status}`,
      stage: 'application-token',
    }, { status: tokenResponse.status || 502 })
  }

  const response = await fetch(`${sandboxApiBase}/create-test-user/agents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.hmrc.1.0+json',
      'Authorization': `Bearer ${tokenData.access_token}`,
    },
    body: JSON.stringify({ serviceNames: ['agent-services'] }),
    cache: 'no-store',
  })

  const text = await response.text()
  let data: any
  try { data = text ? JSON.parse(text) : {} } catch { data = { message: text } }

  if (!response.ok) {
    return NextResponse.json({
      error: data?.message || data?.error_description || data?.code || `HMRC returned ${response.status}`,
      stage: 'create-agent',
    }, { status: response.status })
  }

  return NextResponse.json({
    userId: data.userId,
    password: data.password,
    userFullName: data.userFullName,
    emailAddress: data.emailAddress,
    agentServicesAccountNumber: data.agentServicesAccountNumber,
    warning: 'Sandbox credentials. Store securely and use this exact user during the ASA OAuth sign-in.',
  })
}
