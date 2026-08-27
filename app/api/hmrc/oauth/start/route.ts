import { NextResponse } from 'next/server'
import { hmrcWebBase } from '@/lib/hmrc'
import { signState } from '@/lib/oauth-state'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const taxpayerId = url.searchParams.get('taxpayerId') || 'demo'
  const agentId = url.searchParams.get('agentId')?.trim() || null
  const clientId = process.env.HMRC_CLIENT_ID?.trim()
  const redirectUri = process.env.HMRC_REDIRECT_URI?.trim()
  if (!clientId || !redirectUri) return NextResponse.json({ error: 'HMRC OAuth configuration missing' }, { status: 503 })

  const state = signState(taxpayerId, agentId)
  const auth = new URL(`${hmrcWebBase}/oauth/authorize`)
  auth.searchParams.set('response_type', 'code')
  auth.searchParams.set('client_id', clientId)

  const taxpayerScopes = ['read:self-assessment', 'write:self-assessment']
  const agentAuthorisationScopes = ['write:sent-invitations', 'read:sent-invitations', 'read:check-relationship']
  // An agent connection is used for two distinct HMRC jobs: managing the
  // client relationship and calling MTD Income Tax endpoints on the client's
  // behalf. Request both scope families so the stored agent token can perform
  // the actual quarterly submission after HMRC confirms the relationship.
  const scopes = agentId
    ? [...taxpayerScopes, ...agentAuthorisationScopes]
    : taxpayerScopes
  auth.searchParams.set('scope', scopes.join(' '))

  auth.searchParams.set('state', state)
  auth.searchParams.set('redirect_uri', redirectUri)
  return NextResponse.redirect(auth)
}
