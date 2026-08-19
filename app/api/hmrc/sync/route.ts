import { NextResponse } from 'next/server'
import { hmrcGet } from '@/lib/hmrc'
import { supabaseAdmin } from '@/lib/supabase-admin'

function firstValue(obj: any, keys: string[]) {
  for (const key of keys) {
    const value = obj?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return null
}

function throwIfError(error: any, context: string) {
  if (error) {
    throw new Error(`${context}: ${error.message || JSON.stringify(error)}`)
  }
}

export async function POST(req: Request) {
  const form = await req.formData()
  const taxpayerId = String(form.get('taxpayerId') || 'demo')
  const nino = String(form.get('nino') || '').trim().toUpperCase()
  const mtditid = String(form.get('mtditid') || '').trim().toUpperCase()
  const db = supabaseAdmin()

  try {
    const { data: conn, error: connError } = await db
      .from('hmrc_connections')
      .select('*')
      .eq('taxpayer_id', taxpayerId)
      .single()

    if (connError || !conn?.access_token) {
      throw new Error('Connect this taxpayer to HMRC first')
    }

    const { error: taxpayerError } = await db.from('taxpayers').upsert({
      id: taxpayerId,
      display_name: taxpayerId === 'demo' ? 'HMRC Sandbox Taxpayer' : taxpayerId,
      nino,
      mtditid,
      updated_at: new Date().toISOString()
    })

    throwIfError(taxpayerError, 'Taxpayer update failed')

    const businesses = await hmrcGet(
      `/individuals/business/details/${encodeURIComponent(nino)}/list`,
      conn.access_token,
      'application/vnd.hmrc.2.0+json'
    )

    const list = Array.isArray(businesses?.listOfBusinesses)
      ? businesses.listOfBusinesses
      : []

    const { error: deleteBusinessesError } = await db
      .from('hmrc_businesses')
      .delete()
      .eq('taxpayer_id', taxpayerId)

    throwIfError(deleteBusinessesError, 'Deleting existing businesses failed')

    if (list.length) {
      const { error: insertBusinessesError } = await db
        .from('hmrc_businesses')
        .insert(
          list.map((b: any) => ({
            taxpayer_id: taxpayerId,
            business_id: b.incomeSourceId || b.businessId,
            business_type: b.incomeSourceType || b.type,
            business_name:
              b.businessName ||
              b.tradingName ||
              b.incomeSourceName ||
              null,
            raw: b
          }))
        )

      throwIfError(insertBusinessesError, 'Saving businesses failed')
    }

    const obligations = await hmrcGet(
      `/obligations/details/${encodeURIComponent(nino)}/income-and-expenditure`,
      conn.access_token,
      'application/vnd.hmrc.3.0+json'
    )

    const groups = Array.isArray(obligations?.obligations)
      ? obligations.obligations
      : []

    const all = groups.flatMap((group: any) =>
      (group.obligationDetails || []).map((o: any) => ({
        ...o,
        businessId:
          group.identification ||
          group.businessId ||
          group.incomeSourceId ||
          null
      }))
    )

    const { error: deleteObligationsError } = await db
      .from('hmrc_obligations')
      .delete()
      .eq('taxpayer_id', taxpayerId)

    throwIfError(deleteObligationsError, 'Deleting existing obligations failed')

    if (all.length) {
      const rows = all.map((o: any) => ({
        taxpayer_id: taxpayerId,
        business_id: o.businessId,

        period_start: firstValue(o, [
          'periodStartDate',
          'inboundCorrespondenceFrom',
          'start',
          'PeriodStartDate'
        ]),

        period_end: firstValue(o, [
          'periodEndDate',
          'inboundCorrespondenceTo',
          'end',
          'PeriodEndDate'
        ]),

        due_date: firstValue(o, [
          'dueDate',
          'inboundCorrespondenceDueDate',
          'due',
          'DueDate'
        ]),

        status: firstValue(o, ['status', 'Status']),

        received_date: firstValue(o, [
          'receivedDate',
          'inboundCorrespondenceDateReceived',
          'inboundCorrespondenceReceivedDate',
          'received',
          'ReceivedDate'
        ]),

        raw: o
      }))

      const { error: insertObligationsError } = await db
        .from('hmrc_obligations')
        .insert(rows)

      throwIfError(insertObligationsError, 'Saving obligations failed')
    }

    const { error: syncLogError } = await db.from('hmrc_sync_runs').insert({
      taxpayer_id: taxpayerId,
      status: 'complete',
      businesses_count: list.length,
      obligations_count: all.length,
      completed_at: new Date().toISOString()
    })

    throwIfError(syncLogError, 'Saving sync log failed')

    return NextResponse.redirect(
      new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}?synced=1`, req.url),
      303
    )
  } catch (e: any) {
    await db.from('hmrc_sync_runs').insert({
      taxpayer_id: taxpayerId,
      status: 'failed',
      error_message: e.message || 'Sync failed',
      completed_at: new Date().toISOString()
    })

    return NextResponse.redirect(
      new URL(
        `/taxpayers/${encodeURIComponent(taxpayerId)}?error=${encodeURIComponent(
          e.message || 'Sync failed'
        )}`,
        req.url
      ),
      303
    )
  }
}
