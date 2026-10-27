import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isSameOriginRequest } from '@/lib/request-security'
import { currentWorkspace } from '@/lib/workspace'

function cleanNino(value: string) { return value.trim().toUpperCase().replace(/\s+/g, '') }
function cleanMtditid(value: string) { return value.trim().toUpperCase().replace(/\s+/g, '') }

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  try {
    const workspace = await currentWorkspace()
    if (!workspace) return NextResponse.json({ error: 'Accounting workspace access is not available' }, { status: 403 })
    const body = await req.json()
    const taxpayerId = String(body?.taxpayerId || '').trim()
    const displayName = String(body?.displayName || '').trim()
    const nino = cleanNino(String(body?.nino || ''))
    const mtditid = cleanMtditid(String(body?.mtditid || ''))
    if (!taxpayerId || taxpayerId.length > 200) return NextResponse.json({ error: 'A valid client is required' }, { status: 400 })
    if (!displayName || displayName.length > 120) return NextResponse.json({ error: 'Enter a client name of no more than 120 characters' }, { status: 400 })
    if (nino && !/^[A-Z]{2}\d{6}[A-D]$/.test(nino)) return NextResponse.json({ error: 'Enter a valid NI number, for example AB123456C' }, { status: 400 })
    if (mtditid && !/^[A-Z0-9]{15}$/.test(mtditid)) return NextResponse.json({ error: 'Enter a valid 15 character MTD Income Tax ID' }, { status: 400 })
    const db = supabaseAdmin()
    const { data, error } = await db.from('taxpayers').update({ display_name: displayName, nino, mtditid, updated_at: new Date().toISOString() }).eq('id', taxpayerId).eq('firm_id', workspace.firmId).select('id').maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Client details could not be updated' }, { status: 500 })
  }
}
