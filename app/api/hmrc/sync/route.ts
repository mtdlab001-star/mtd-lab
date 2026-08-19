import { NextResponse } from 'next/server'
import { hmrcGet } from '@/lib/hmrc'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: Request) {
  const form = await req.formData()
  const taxpayerId = String(form.get('taxpayerId') || 'demo')
  const nino = String(form.get('nino') || '').trim().toUpperCase()
  const mtditid = String(form.get('mtditid') || '').trim().toUpperCase()
  const db = supabaseAdmin()
  try {
    const { data: conn, error: connError } = await db.from('hmrc_connections').select('*').eq('taxpayer_id', taxpayerId).single()
    if (connError || !conn?.access_token) throw new Error('Connect this taxpayer to HMRC first')
    await db.from('taxpayers').upsert({ id: taxpayerId, display_name: taxpayerId === 'demo' ? 'HMRC Sandbox Taxpayer' : taxpayerId, nino, mtditid, updated_at: new Date().toISOString() })

    const businesses = await hmrcGet(`/individuals/business/details/${encodeURIComponent(nino)}/list`, conn.access_token, 'application/vnd.hmrc.2.0+json')
    const list = Array.isArray(businesses?.listOfBusinesses) ? businesses.listOfBusinesses : []
    await db.from('hmrc_businesses').delete().eq('taxpayer_id', taxpayerId)
    if (list.length) await db.from('hmrc_businesses').insert(list.map((b:any)=>({ taxpayer_id: taxpayerId, business_id: b.incomeSourceId || b.businessId, business_type: b.incomeSourceType || b.type, business_name: b.businessName || b.tradingName || b.incomeSourceName || null, raw: b })))

    const obligations = await hmrcGet(`/obligations/details/${encodeURIComponent(nino)}/income-and-expenditure`, conn.access_token, 'application/vnd.hmrc.3.0+json')
    const all = (Array.isArray(obligations?.obligations) ? obligations.obligations : []).flatMap((group:any) => (group.obligationDetails || []).map((o:any)=>({ ...o, businessId: group.identification || group.businessId || group.incomeSourceId || null })))
    await db.from('hmrc_obligations').delete().eq('taxpayer_id', taxpayerId)
    if (all.length) await db.from('hmrc_obligations').insert(all.map((o:any)=>({ taxpayer_id: taxpayerId, business_id: o.businessId, period_start: o.inboundCorrespondenceFrom || o.periodStartDate || o.start, period_end: o.inboundCorrespondenceTo || o.periodEndDate || o.end, due_date: o.due, status: o.status, received_date: o.received, raw: o })))
    await db.from('hmrc_sync_runs').insert({ taxpayer_id: taxpayerId, status: 'complete', businesses_count: list.length, obligations_count: all.length, completed_at: new Date().toISOString() })
    return NextResponse.redirect(new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}?synced=1`, req.url), 303)
  } catch(e:any) {
    await db.from('hmrc_sync_runs').insert({ taxpayer_id: taxpayerId, status: 'failed', error_message: e.message || 'Sync failed', completed_at: new Date().toISOString() })
    return NextResponse.redirect(new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}?error=${encodeURIComponent(e.message || 'Sync failed')}`, req.url), 303)
  }
}
