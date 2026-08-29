import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isSameOriginRequest } from '@/lib/request-security'

export const dynamic = 'force-dynamic'

const CONFIRMATION = 'RESET MTD LAB SANDBOX'

function isHmrcSandbox() {
  const base = process.env.HMRC_BASE_URL || 'https://test-api.service.hmrc.gov.uk'
  return process.env.HMRC_ENV !== 'production' && base.includes('test-api.service.hmrc.gov.uk')
}

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) return new NextResponse('Invalid request origin', { status: 403 })

  if (!isHmrcSandbox()) {
    return NextResponse.json({ error: 'Sandbox reset is disabled outside the HMRC sandbox.' }, { status: 403 })
  }

  let body: any = {}
  try { body = await req.json() } catch {}
  if (String(body?.confirmation || '').trim() !== CONFIRMATION) {
    return NextResponse.json({ error: `Type ${CONFIRMATION} exactly to confirm.` }, { status: 400 })
  }

  const db = supabaseAdmin()

  // Taxpayer-owned HMRC connections, businesses, obligations, sync history,
  // authorisations and filing evidence use ON DELETE CASCADE from taxpayers.
  // Agent OAuth connections and authorisations use ON DELETE CASCADE from agents.
  // Delete taxpayers first, then agents, leaving app users/configuration untouched.
  const { data: taxpayers, error: taxpayerReadError } = await db.from('taxpayers').select('id')
  if (taxpayerReadError) return NextResponse.json({ error: taxpayerReadError.message }, { status: 500 })

  const taxpayerIds = (taxpayers || []).map((row: any) => row.id)
  if (taxpayerIds.length) {
    const { error } = await db.from('taxpayers').delete().in('id', taxpayerIds)
    if (error) return NextResponse.json({ error: `Taxpayer reset failed: ${error.message}` }, { status: 500 })
  }

  const { data: agents, error: agentReadError } = await db.from('mtd_agents').select('id')
  if (agentReadError) return NextResponse.json({ error: agentReadError.message }, { status: 500 })

  const agentIds = (agents || []).map((row: any) => row.id)
  if (agentIds.length) {
    const { error } = await db.from('mtd_agents').delete().in('id', agentIds)
    if (error) return NextResponse.json({ error: `Agent reset failed: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    removedTaxpayers: taxpayerIds.length,
    removedAgents: agentIds.length,
    message: 'MTD Lab sandbox records reset. HMRC test identities themselves are not deleted by this action.',
  })
}
