import Link from 'next/link'
import { redirect } from 'next/navigation'
import TaxpayerSidebar from '@/app/components/TaxpayerSidebar'
import FraudContextFields from '@/app/components/FraudContextFields'
import { currentWorkspace } from '@/lib/workspace'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { listMtdIncomeSources } from '@/lib/mtd-income-sources-server'
import { taxYearHasEnded } from '@/lib/year-end-finalisation'
import { validAnnualTaxYear } from '@/lib/hmrc-compatibility'

export const dynamic = 'force-dynamic'

export default async function AnnualPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params
  const qs = await searchParams
  const workspace = await currentWorkspace()
  if (!workspace) redirect('/login')
  const db = supabaseAdmin()
  const { data: taxpayer } = await db.from('taxpayers').select('id').eq('id', id).eq('firm_id', workspace.firmId).maybeSingle()
  if (!taxpayer) redirect('/taxpayers')
  const sources = (await listMtdIncomeSources(db, id, workspace.firmId)).filter(row => row.sourceType !== 'foreign-property')
  const { data: authorisations } = await db.from('mtd_agent_authorisations').select('agent_id,expires_at,revoked_at').eq('firm_id', workspace.firmId).eq('taxpayer_id', id).eq('status', 'authorised').eq('can_manage_year_end', true)
  const agentIds = (authorisations || []).filter(row => !row.revoked_at && (!row.expires_at || new Date(row.expires_at).getTime() > Date.now())).map(row => row.agent_id)
  const { data: agents } = agentIds.length ? await db.from('mtd_agents').select('id,agent_name,hmrc_arn').eq('firm_id', workspace.firmId).eq('status', 'active').in('id', agentIds) : { data: [] }
  const { data: draft } = qs.draftId ? await db.from('mtd_submission_audit').select('id,tax_year,business_id,request_payload,acting_agent_id,created_at').eq('id', qs.draftId).eq('firm_id', workspace.firmId).eq('taxpayer_id', id).eq('event_type', 'annual_compatibility_preparation').eq('status', 'prepared').maybeSingle() : { data: null }
  const taxYear = validAnnualTaxYear(qs.taxYear || '') ? qs.taxYear! : '2026-27'
  const source = draft ? sources.find(row => row.businessId === draft.business_id) : null
  const changes = source?.sourceType === 'uk-property' ? draft?.request_payload?.ukProperty : draft?.request_payload
  const firstYearAllowance = changes?.allowances?.firstYearAllowanceOnPlantAndMachinery
  const production = process.env.HMRC_ENVIRONMENT === 'production'
  const canSubmit = Boolean(draft && source && taxYearHasEnded(draft.tax_year) && (!production || process.env.HMRC_ALLOW_PRODUCTION_SUBMISSIONS === 'true') && (!production || firstYearAllowance === undefined) && Date.now() - new Date(draft.created_at).getTime() <= 30 * 60 * 1000)
  const money = (value: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value)
  return <div className="shell"><TaxpayerSidebar taxpayerId={id} active="adjustments"/><main className="main">
    <div className="top"><div><h1 className="pageTitle">Business annual adjustments and allowances</h1><p className="muted">September 2026 compatibility fields for Self Employment and UK Property annual submissions. These are not quarterly or BSAS adjustments.</p></div><span className="badge">{production ? 'Production submissions controlled' : 'Sandbox testing'}</span></div>
    {qs.error && <div className="status statusError">{qs.error}</div>}
    {qs.accepted && <div className="status"><strong>HMRC accepted the annual changes.</strong><div>Review the refreshed HMRC calculation before finalisation.</div></div>}
    {qs.correlationId && <p className="muted">HMRC correlation ID: {qs.correlationId}</p>}
    <div className="status"><strong>Preparation is available now.</strong><div>Submission stays locked until the tax year has ended. Plant and machinery first year allowances are currently sandbox only. Existing annual data is retrieved and preserved before applying these changes. Leave a field blank to keep its current value.</div></div>
    {draft && source && <section className="panel" style={{ marginTop: 16 }}><h2>Review annual changes</h2><p>{source.sourceType === 'uk-property' ? 'UK Property' : 'Self Employment'} · {draft.business_id} · {draft.tax_year}</p><p className="muted">Acting capacity: {draft.acting_agent_id ? agents?.find(row => row.id === draft.acting_agent_id)?.agent_name || 'Authorised agent (permission rechecked on submission)' : 'Taxpayer connection'}. This preparation is not evidence of HMRC acceptance. Reviews expire after 30 minutes.</p><div className="tableWrap"><table><thead><tr><th>Annual field</th><th>New amount</th></tr></thead><tbody>{changes?.adjustments?.adjustmentToProfitsForClass4 !== undefined && <tr><td>Class 4 profit adjustment</td><td>{money(changes.adjustments.adjustmentToProfitsForClass4)}</td></tr>}{firstYearAllowance !== undefined && <tr><td>Plant and machinery first year allowance (sandbox only)</td><td>{money(firstYearAllowance)}</td></tr>}</tbody></table></div><form method="post" action="/api/hmrc/annual"><input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="draftId" value={draft.id}/><input type="hidden" name="action" value="submit"/><label><input type="checkbox" name="annualConfirmed" value="yes" required/> I have checked these annual changes and understand existing HMRC annual entries will be preserved.</label>{canSubmit && <FraudContextFields/>}<button className="btn" type="submit" disabled={!canSubmit}>{canSubmit ? 'Submit reviewed annual changes to HMRC' : 'Annual submission currently locked'}</button></form></section>}
    {sources.map(row => <section className="panel" key={row.businessId} style={{ marginTop: 16 }}><h2>{row.sourceType === 'uk-property' ? 'UK Property' : 'Self Employment'}</h2><p className="mono">{row.businessId}</p><form method="post" action="/api/hmrc/annual"><input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="businessId" value={row.businessId}/><input type="hidden" name="action" value="prepare"/><label>Tax year</label><input className="field" name="taxYear" defaultValue={taxYear} required pattern="20[0-9]{2}-[0-9]{2}"/><label>HMRC acting capacity</label><select className="selectField" name="actingAgentId" defaultValue=""><option value="">Taxpayer connection</option>{agents?.map(agent => <option value={agent.id} key={agent.id}>{agent.agent_name} · ARN {agent.hmrc_arn}</option>)}</select><div className="formGrid">{row.sourceType === 'self-employment' && <label>Class 4 profit adjustment (£)<input className="field" name="adjustmentToProfitsForClass4" inputMode="decimal" placeholder="Leave blank if unchanged"/></label>}<label>Plant and machinery first year allowance (£), sandbox only<input className="field" name="firstYearAllowanceOnPlantAndMachinery" inputMode="decimal" placeholder="Leave blank if unchanged"/></label></div><button className="btn" type="submit">Prepare and review annual changes</button></form></section>)}
    {!sources.length && <p className="empty">No applicable Self Employment or UK Property sources were found. This release does not add these allowance fields to Foreign Property.</p>}
    <Link className="btn btnSmall" style={{ marginTop: 16 }} href={`/taxpayers/${id}/end-of-year/adjustments?taxYear=${encodeURIComponent(taxYear)}`}>Back to adjustments and losses</Link>
  </main></div>
}
