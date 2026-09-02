import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isSameOriginRequest } from '@/lib/request-security'
import { currentWorkspace } from '@/lib/workspace'

type ClientAction = 'archive' | 'restore' | 'delete'

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })

  try {
    const workspace=await currentWorkspace()
    if(!workspace)return NextResponse.json({error:'Accounting workspace access is not available'},{status:403})
    const body = await req.json()
    const taxpayerId = String(body?.taxpayerId || '').trim()
    const action = String(body?.action || '') as ClientAction
    const confirmation = String(body?.confirmation || '')

    if (!taxpayerId || taxpayerId.length > 200) return NextResponse.json({ error: 'A valid taxpayer is required' }, { status: 400 })
    if (!['archive', 'restore', 'delete'].includes(action)) return NextResponse.json({ error: 'Invalid client action' }, { status: 400 })

    const db = supabaseAdmin()
    const { data: taxpayer, error: lookupError } = await db
      .from('taxpayers')
      .select('id,display_name,archived_at')
      .eq('id', taxpayerId)
      .eq('firm_id',workspace.firmId)
      .maybeSingle()

    if (lookupError) throw lookupError
    if (!taxpayer) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    if (action === 'archive' || action === 'restore') {
      const archivedAt = action === 'archive' ? new Date().toISOString() : null
      const { data, error } = await db
        .from('taxpayers')
        .update({ archived_at: archivedAt, updated_at: new Date().toISOString() })
        .eq('id', taxpayerId)
        .eq('firm_id',workspace.firmId)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) return NextResponse.json({ error: 'Client was not updated' }, { status: 409 })
      return NextResponse.json({ success: true, action })
    }

    if (confirmation !== taxpayer.display_name) {
      return NextResponse.json({ error: 'Enter the client name exactly to confirm permanent deletion' }, { status: 400 })
    }

    const { data: deleted, error: deleteError } = await db
      .from('taxpayers')
      .delete()
      .eq('id', taxpayerId)
      .eq('firm_id',workspace.firmId)
      .select('id')
      .maybeSingle()

    if (deleteError) throw deleteError
    if (!deleted) return NextResponse.json({ error: 'Client was not deleted' }, { status: 409 })
    return NextResponse.json({ success: true, action: 'delete' })
  } catch {
    return NextResponse.json({ error: 'The client action could not be completed' }, { status: 500 })
  }
}
