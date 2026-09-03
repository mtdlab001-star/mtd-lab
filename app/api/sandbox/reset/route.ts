import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isSameOriginRequest } from '@/lib/request-security'
import { currentWorkspace } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

const CONFIRMATION = 'RESET MTD LAB SANDBOX'

function isHmrcSandbox() {
  const base = process.env.HMRC_BASE_URL || 'https://test-api.service.hmrc.gov.uk'
  return process.env.HMRC_ENV !== 'production' && base.includes('test-api.service.hmrc.gov.uk')
}

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) return new NextResponse('Invalid request origin', { status: 403 })

  const workspace = await currentWorkspace()
  if (!workspace) return NextResponse.json({ error: 'Accounting workspace access is not available.' }, { status: 401 })

  if (!isHmrcSandbox()) {
    return NextResponse.json({ error: 'Sandbox reset is disabled outside the HMRC sandbox.' }, { status: 403 })
  }

  let body: any = {}
  try { body = await req.json() } catch {}
  if (String(body?.confirmation || '').trim() !== CONFIRMATION) {
    return NextResponse.json({ error: `Type ${CONFIRMATION} exactly to confirm.` }, { status: 400 })
  }

  const db = supabaseAdmin()

  // Only remove records owned by the signed-in accounting firm's workspace.
  // Cascading foreign keys remove that firm's taxpayer/agent child records while
  // leaving every other firm's data untouched.
  const { data: taxpayers, error: taxpayerReadError } = await db
    .from('taxpayers')
    .select('id')
    .eq('firm_id', workspace.firmId)
  if (taxpayerReadError) return NextResponse.json({ error: taxpayerReadError.message }, { status: 500 })

  const taxpayerIds = (taxpayers || []).map((row: any) => row.id)
  if (taxpayerIds.length) {
    const { error } = await db
      .from('taxpayers')
      .delete()
      .eq('firm_id', workspace.firmId)
      .in('id', taxpayerIds)
    if (error) return NextResponse.json({ error: `Taxpayer reset failed: ${error.message}` }, { status: 500 })
  }

  const { data: agents, error: agentReadError } = await db
    .from('mtd_agents')
    .select('id')
    .eq('firm_id', workspace.firmId)
  if (agentReadError) return NextResponse.json({ error: agentReadError.message }, { status: 500 })

  const agentIds = (agents || []).map((row: any) => row.id)
  if (agentIds.length) {
    const { error } = await db
      .from('mtd_agents')
      .delete()
      .eq('firm_id', workspace.firmId)
      .in('id', agentIds)
    if (error) return NextResponse.json({ error: `Agent reset failed: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    removedTaxpayers: taxpayerIds.length,
    removedAgents: agentIds.length,
    message: `Sandbox records reset for ${workspace.firmName}. Other firms were not affected.`,
  })
}
