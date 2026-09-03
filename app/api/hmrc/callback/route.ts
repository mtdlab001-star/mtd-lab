import { NextResponse } from 'next/server'
import { exchangeCode } from '@/lib/hmrc'
import { verifyState } from '@/lib/oauth-state'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { currentWorkspace, taxpayerBelongsToWorkspace } from '@/lib/workspace'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const error = url.searchParams.get('error')
  if (error) return NextResponse.json({ error, error_description: url.searchParams.get('error_description') }, { status: 400 })
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) return NextResponse.json({ error: 'Missing OAuth code or state' }, { status: 400 })
  try {
    const { taxpayerId, agentId, firmId } = verifyState(state)
    const workspace=await currentWorkspace()
    if(!workspace||!firmId||workspace.firmId!==firmId)throw new Error('OAuth workspace does not match the active accounting firm')
    if(!await taxpayerBelongsToWorkspace(taxpayerId,workspace))throw new Error('Taxpayer not found in this accounting workspace')
    const db = supabaseAdmin()
    if(agentId){const {data:agent}=await db.from('mtd_agents').select('id').eq('id',agentId).eq('firm_id',workspace.firmId).maybeSingle();if(!agent)throw new Error('Agent not found in this accounting workspace')}
    const token = await exchangeCode(code)
    const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString()
    if (agentId) {
      const { error: agentDbError } = await db.from('agent_hmrc_connections').upsert({ firm_id:workspace.firmId,agent_id: agentId, environment: process.env.HMRC_ENVIRONMENT || 'sandbox', access_token: token.access_token, refresh_token: token.refresh_token, token_expires_at: expiresAt, scope: token.scope || null, connected_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'agent_id' })
      if (agentDbError) throw agentDbError
      return NextResponse.redirect(new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/agents?agentConnected=1`, req.url))
    }
    const { error: dbError } = await db.from('hmrc_connections').upsert({ firm_id:workspace.firmId,taxpayer_id: taxpayerId, environment: process.env.HMRC_ENVIRONMENT || 'sandbox', access_token: token.access_token, refresh_token: token.refresh_token, token_expires_at: expiresAt, scope: token.scope || null, connected_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'taxpayer_id' })
    if (dbError) throw dbError
    return NextResponse.redirect(new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}?connected=1`, req.url))
  } catch (e:any) { return NextResponse.json({ error: e.message || 'OAuth callback failed' }, { status: 400 }) }
}
