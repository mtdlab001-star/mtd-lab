import { NextResponse } from 'next/server'
import { currentWorkspace } from '@/lib/workspace'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isSameOriginRequest } from '@/lib/request-security'
import { listMtdIncomeSources } from '@/lib/mtd-income-sources-server'
import { agentCan } from '@/lib/agent-authorisation'
import { getHmrcAccessTokenForActingCapacity } from '@/lib/hmrc-connection'
import { buildFraudHeaders } from '@/lib/hmrc-fraud'
import { hmrcApiBase } from '@/lib/hmrc'
import { hmrcAcceptHeader } from '@/lib/hmrc-api-versions'
import { taxYearHasEnded } from '@/lib/year-end-finalisation'
import { annualCompatibilityPatch, annualEndpoint, assertSandboxFeature, mergeAnnualCompatibility } from '@/lib/hmrc-compatibility'

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) return new NextResponse('Invalid request origin', { status: 403 })
  const workspace = await currentWorkspace()
  if (!workspace) return new NextResponse('Accounting workspace access is not available', { status: 403 })
  const form = await req.formData()
  const taxpayerId = String(form.get('taxpayerId') || '')
  const back = new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/end-of-year/annual`, req.url)
  const db = supabaseAdmin()
  try {
    const { data: taxpayer, error: taxpayerError } = await db.from('taxpayers').select('nino').eq('id', taxpayerId).eq('firm_id', workspace.firmId).maybeSingle()
    if (taxpayerError || !taxpayer?.nino) throw new Error('Taxpayer is not available in this accounting workspace or has no NINO.')
    const action = String(form.get('action') || '')
    let taxYear = String(form.get('taxYear') || '')
    let businessId = String(form.get('businessId') || '')
    let actingAgentId = String(form.get('actingAgentId') || '').trim() || null
    let patch: any
    if (action === 'submit') {
      const draftId = String(form.get('draftId') || '')
      const { data: draft, error } = await db.from('mtd_submission_audit').select('tax_year,business_id,acting_agent_id,request_payload,created_at').eq('id', draftId).eq('firm_id', workspace.firmId).eq('taxpayer_id', taxpayerId).eq('event_type', 'annual_compatibility_preparation').eq('status', 'prepared').maybeSingle()
      if (error || !draft) throw new Error('The annual review is not available in this workspace.')
      const draftAge = Date.now() - new Date(draft.created_at).getTime()
      if (!Number.isFinite(draftAge) || draftAge < 0 || draftAge > 30 * 60 * 1000) throw new Error('This annual review has expired. Prepare and review the amounts again.')
      taxYear = draft.tax_year
      businessId = draft.business_id
      actingAgentId = draft.acting_agent_id
      patch = draft.request_payload
      back.searchParams.set('draftId', draftId)
    } else if (action !== 'prepare') throw new Error('Select a valid annual action.')
    back.searchParams.set('taxYear', taxYear)
    const sources = await listMtdIncomeSources(db, taxpayerId, workspace.firmId)
    const source = sources.find(row => row.businessId === businessId)
    if (!source || source.sourceType === 'foreign-property') throw new Error('Select an applicable Self Employment or UK Property business in this workspace.')
    if (actingAgentId && !await agentCan(taxpayerId, actingAgentId, 'can_manage_year_end')) throw new Error('This agent does not have current year end permission for this taxpayer.')
    if (action === 'prepare') {
      patch = annualCompatibilityPatch(source.sourceType, taxYear, form.get('adjustmentToProfitsForClass4'), form.get('firstYearAllowanceOnPlantAndMachinery'))
      const { data: draft, error } = await db.from('mtd_submission_audit').insert({ firm_id: workspace.firmId, taxpayer_id: taxpayerId, tax_year: taxYear, business_id: businessId, acting_agent_id: actingAgentId, event_type: 'annual_compatibility_preparation', status: 'prepared', request_payload: patch, request_summary: { sourceType: source.sourceType, actingCapacity: actingAgentId ? 'agent' : 'direct' } }).select('id').single()
      if (error || !draft) throw new Error('The annual review could not be saved. No HMRC request was made.')
      back.searchParams.set('draftId', draft.id)
      return NextResponse.redirect(back, 303)
    }
    // Revalidate server stored values and eligibility. Client supplied hidden amounts are never trusted.
    const section = source.sourceType === 'uk-property' ? patch?.ukProperty : patch
    patch = annualCompatibilityPatch(source.sourceType, taxYear, section?.adjustments?.adjustmentToProfitsForClass4, section?.allowances?.firstYearAllowanceOnPlantAndMachinery)
    if (!taxYearHasEnded(taxYear)) throw new Error('Annual submissions remain locked until the selected tax year has ended.')
    if (process.env.HMRC_ENVIRONMENT === 'production' && process.env.HMRC_ALLOW_PRODUCTION_SUBMISSIONS !== 'true') throw new Error('Production HMRC submissions remain locked until explicitly enabled.')
    assertSandboxFeature('Plant and machinery first year allowance', section?.allowances?.firstYearAllowanceOnPlantAndMachinery !== undefined)
    if (form.get('annualConfirmed') !== 'yes') throw new Error('Confirm the reviewed annual changes before submitting.')
    const fraud = buildFraudHeaders(req, form, taxpayerId)
    if (fraud.missing.length) throw new Error(`Missing HMRC fraud prevention data: ${fraud.missing.join(', ')}`)
    const token = await getHmrcAccessTokenForActingCapacity(taxpayerId, actingAgentId)
    const endpoint = annualEndpoint(source.sourceType, taxpayer.nino, businessId, taxYear)
    const headers = { Authorization: `Bearer ${token}`, Accept: hmrcAcceptHeader(source.sourceType === 'uk-property' ? 'propertyBusiness' : 'selfEmploymentBusiness'), ...fraud.headers, ...(process.env.HMRC_ENVIRONMENT === 'production' ? {} : { 'Gov-Test-Scenario': 'STATEFUL' }) }
    // Fetch the existing resource immediately before PUT so existing annual allowances are not erased.
    const existingResponse = await fetch(`${hmrcApiBase}${endpoint}`, { headers, cache: 'no-store' })
    const existingText = await existingResponse.text()
    const existingPayload = existingText ? JSON.parse(existingText) : {}
    const absent = existingResponse.status === 404 && existingPayload.code === 'MATCHING_RESOURCE_NOT_FOUND'
    if (!existingResponse.ok && !absent) throw new Error(existingPayload.message || 'Could not safely retrieve the existing HMRC annual submission. No changes were submitted.')
    const payload = mergeAnnualCompatibility(absent ? {} : existingPayload, patch, source.sourceType)
    const response = await fetch(`${hmrcApiBase}${endpoint}`, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload), cache: 'no-store' })
    const body = await response.text()
    let result: any = {}
    try { result = body ? JSON.parse(body) : {} } catch { result = { raw: body } }
    const correlationId = response.headers.get('x-correlationid') || response.headers.get('x-correlation-id')
    const accepted = response.status === 204
    const { error: auditError } = await db.from('mtd_submission_audit').insert({ firm_id: workspace.firmId, taxpayer_id: taxpayerId, tax_year: taxYear, business_id: businessId, acting_agent_id: actingAgentId, event_type: 'business_annual_submission', status: accepted ? 'accepted' : 'rejected', hmrc_status: response.status, hmrc_correlation_id: correlationId, request_payload: payload, response_payload: result, request_summary: { sourceType: source.sourceType, actingCapacity: actingAgentId ? 'agent' : 'direct' } })
    if (correlationId) back.searchParams.set('correlationId', correlationId)
    if (auditError) throw new Error(`HMRC returned ${response.status}, but the audit record could not be saved. Check HMRC before retrying.`)
    if (!accepted) throw new Error(result.message || result.code || `HMRC returned ${response.status}; annual acceptance was not confirmed.`)
    back.searchParams.delete('draftId')
    back.searchParams.set('accepted', '1')
    return NextResponse.redirect(back, 303)
  } catch (error: any) {
    back.searchParams.set('error', error.message || 'The annual submission needs attention.')
    return NextResponse.redirect(back, 303)
  }
}
