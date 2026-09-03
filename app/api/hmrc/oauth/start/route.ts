import { NextResponse } from 'next/server'
import { hmrcWebBase } from '@/lib/hmrc'
import { signState } from '@/lib/oauth-state'
import { currentWorkspace, taxpayerBelongsToWorkspace } from '@/lib/workspace'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: Request) {
  const workspace=await currentWorkspace()
  if(!workspace)return new NextResponse('Accounting workspace access is not available',{status:401})
  const url = new URL(req.url)
  const taxpayerId = url.searchParams.get('taxpayerId') || ''
  const agentId = url.searchParams.get('agentId')?.trim() || null
  if(!taxpayerId||!await taxpayerBelongsToWorkspace(taxpayerId,workspace))return new NextResponse('Taxpayer not found',{status:404})
  if(agentId){const {data:agent}=await supabaseAdmin().from('mtd_agents').select('id').eq('id',agentId).eq('firm_id',workspace.firmId).maybeSingle();if(!agent)return new NextResponse('Agent not found',{status:404})}
  const clientId = process.env.HMRC_CLIENT_ID?.trim()
  const redirectUri = process.env.HMRC_REDIRECT_URI?.trim()
  if (!clientId || !redirectUri) return NextResponse.json({ error: 'HMRC OAuth configuration missing' }, { status: 503 })

  const state = signState(taxpayerId, agentId, workspace.firmId)
  const auth = new URL(`${hmrcWebBase}/oauth/authorize`)
  auth.searchParams.set('response_type', 'code')
  auth.searchParams.set('client_id', clientId)

  const taxpayerScopes = ['read:self-assessment', 'write:self-assessment']
  const agentAuthorisationScopes = ['write:sent-invitations', 'read:sent-invitations', 'read:check-relationship']
  const scopes = agentId ? [...taxpayerScopes, ...agentAuthorisationScopes] : taxpayerScopes
  auth.searchParams.set('scope', scopes.join(' '))

  auth.searchParams.set('state', state)
  auth.searchParams.set('redirect_uri', redirectUri)
  return NextResponse.redirect(auth)
}
