import { NextResponse } from 'next/server'
import { exchangeCode } from '@/lib/hmrc'
import { verifyState } from '@/lib/oauth-state'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const error = url.searchParams.get('error')
  if (error) return NextResponse.json({ error, error_description: url.searchParams.get('error_description') }, { status: 400 })
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) return NextResponse.json({ error: 'Missing OAuth code or state' }, { status: 400 })
  try {
    const { taxpayerId, agentId } = verifyState(state)
    const token = await exchangeCode(code)
    const db = supabaseAdmin()
    const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString()
    if (agentId) {
      const { error: agentDbError } = await db.from('agent_hmrc_connections').upsert({ agent_id: agentId, environment: process.env.HMRC_ENVIRONMENT || 'sandbox', access_token: token.access_token, refresh_token: token.refresh_token, token_expires_at: expiresAt, scope: token.scope || null, connected_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'agent_id' })
      if (agentDbError) throw agentDbError
      return NextResponse.redirect(new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/agents?agentConnected=1`, req.url))
    }
    const { error: dbError } = await db.from('hmrc_connections').upsert({ taxpayer_id: taxpayerId, environment: process.env.HMRC_ENVIRONMENT || 'sandbox', access_token: token.access_token, refresh_token: token.refresh_token, token_expires_at: expiresAt, scope: token.scope || null, connected_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'taxpayer_id' })
    if (dbError) throw dbError
    return NextResponse.redirect(new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}?connected=1`, req.url))
  } catch (e:any) { return NextResponse.json({ error: e.message || 'OAuth callback failed' }, { status: 400 }) }
}
