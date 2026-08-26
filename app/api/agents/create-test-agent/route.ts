import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  if (process.env.HMRC_ENV === 'production' || process.env.NODE_ENV === 'production' && process.env.HMRC_BASE_URL?.includes('api.service.hmrc.gov.uk') && !process.env.HMRC_BASE_URL?.includes('test-api')) {
    return NextResponse.json({ error: 'Sandbox test user creation is disabled in production HMRC mode.' }, { status: 403 })
  }

  const clientId = process.env.HMRC_CLIENT_ID
  const clientSecret = process.env.HMRC_CLIENT_SECRET
  const baseUrl = process.env.HMRC_BASE_URL || 'https://test-api.service.hmrc.gov.uk'

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'HMRC sandbox application credentials are not configured.' }, { status: 500 })
  }

  const response = await fetch(`${baseUrl}/create-test-user/agents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.hmrc.1.0+json',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: JSON.stringify({ serviceNames: ['agent-services'] }),
    cache: 'no-store',
  })

  const text = await response.text()
  let data: any
  try { data = text ? JSON.parse(text) : {} } catch { data = { message: text } }

  if (!response.ok) {
    return NextResponse.json({ error: data?.message || data?.code || `HMRC returned ${response.status}`, hmrc: data }, { status: response.status })
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
