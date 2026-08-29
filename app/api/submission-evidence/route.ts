import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isSameOriginRequest } from '@/lib/request-security'
import { incomeSourceTypeFromBusinessId, type MtdIncomeSourceType } from '@/lib/mtd-income-source'
import { quarterlyEvidenceDetail } from '@/lib/submission-evidence'

function esc(v:any){return String(v??'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]||c))}
function taxYearEnded(taxYear:string){const start=Number(taxYear.slice(0,4));return Number.isFinite(start)&&Date.now()>=Date.UTC(start+1,3,6)}
function sourceTypeKey(r:any):MtdIncomeSourceType{const raw=r?.request_payload||{};const type=String(raw?.incomeSourceType||raw?.payload?.incomeSourceType||'').toLowerCase();if(type.includes('foreign'))return 'foreign-property';if(type.includes('property'))return 'uk-property';return incomeSourceTypeFromBusinessId(r.business_id)}
function sourceType(r:any){const type=sourceTypeKey(r);if(type==='foreign-property')return 'Foreign Property';if(type==='uk-property')return 'UK Property';return 'Self Assessment'}
function reconciliationStatus(r:any,obligations:any[]){if(r.status!=='submitted')return r.status||'unknown';const o=obligations.find((x:any)=>x.period_end===r.period_end&&(!x.business_id||x.business_id===r.business_id));if(String(o?.status||'').toLowerCase()==='fulfilled')return 'Accepted, obligation fulfilled';return 'Accepted, obligation open'}

export async function GET(req:Request){
 if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
 const u=new URL(req.url);const taxpayerId=String(u.searchParams.get('taxpayerId')||'');const taxYear=String(u.searchParams.get('taxYear')||'')
 if(!taxpayerId||!/^20\d{2}-\d{2}$/.test(taxYear))return new NextResponse('Taxpayer and tax year are required',{status:400})
 const db=supabaseAdmin();const startYear=Number(taxYear.slice(0,4))
 const [{data:taxpayer},{data:audit},{data:quarterly},{data:obligations}]=await Promise.all([
  db.from('taxpayers').select('display_name,nino').eq('id',taxpayerId).maybeSingle(),
  db.from('mtd_submission_audit').select('*').eq('taxpayer_id',taxpayerId).eq('tax_year',taxYear).order('created_at',{ascending:true}),
  db.from('hmrc_quarterly_submissions').select('*').eq('taxpayer_id',taxpayerId).eq('tax_year',taxYear).order('created_at',{ascending:true}),
  db.from('hmrc_obligations').select('business_id,period_start,period_end,status,received_date').eq('taxpayer_id',taxpayerId).gte('period_start',`${startYear}-04-06`).lte('period_end',`${startYear+1}-04-05`)
 ])
 if(!taxpayer)return new NextResponse('Taxpayer not found',{status:404})
 const agentIds=Array.from(new Set([...(quarterly||[]).map((r:any)=>r.acting_agent_id),...(audit||[]).map((r:any)=>r.acting_agent_id)].filter(Boolean)))
 let agents=new Map<string,any>()
 if(agentIds.length){const {data:agentRows}=await db.from('mtd_agents').select('id,agent_name,organisation_name,hmrc_arn').in('id',agentIds);agents=new Map((agentRows||[]).map((a:any)=>[a.id,a]))}
 const actor=(r:any)=>{if(!r.acting_agent_id)return 'Direct';const a:any=agents.get(r.acting_agent_id);if(!a)return 'Authorised agent';return `Authorised agent: ${a.agent_name}${a.organisation_name?` (${a.organisation_name})`:''}${a.hmrc_arn?` · ARN ${a.hmrc_arn}`:''}`}
 const obs=obligations||[]
 const quarterlyRows=quarterly||[]
 const auditRows=audit||[]
 const acceptedQuarterly=quarterlyRows.filter((r:any)=>r.status==='submitted')
 const counts=[
  {label:'Self Assessment quarterly updates',value:acceptedQuarterly.filter((r:any)=>sourceTypeKey(r)==='self-employment').length},
  {label:'UK Property quarterly updates',value:acceptedQuarterly.filter((r:any)=>sourceTypeKey(r)==='uk-property').length},
  {label:'Foreign Property quarterly updates',value:acceptedQuarterly.filter((r:any)=>sourceTypeKey(r)==='foreign-property').length},
  {label:'HMRC calculation retrievals',value:auditRows.filter((r:any)=>r.event_type==='tax_calculation_retrieval'&&r.status==='accepted').length},
  {label:'Final Declarations',value:auditRows.filter((r:any)=>r.event_type==='final_declaration'&&r.status==='accepted').length}
 ]
 const finalAccepted=counts.find(c=>c.label==='Final Declarations')?.value||0
 const finalStatus=finalAccepted>0?'Accepted by HMRC':taxYearEnded(taxYear)?'Not yet accepted':'Not due yet, tax year still open'
 const rows=[
  ...quarterlyRows.map((r:any)=>({date:r.submitted_at||r.created_at,type:'Quarterly update',actor:actor(r),status:reconciliationStatus(r,obs),reference:r.hmrc_correlation_id||'',detail:quarterlyEvidenceDetail(r,sourceType(r))})),
  ...auditRows.map((r:any)=>({date:r.submitted_at||r.created_at,type:r.event_type,actor:actor(r),status:r.status,reference:r.hmrc_correlation_id||r.calculation_id||'',detail:r.hmrc_status?`HMRC HTTP ${r.hmrc_status}`:''}))
 ].sort((a:any,b:any)=>String(a.date).localeCompare(String(b.date)))
 const html=`<!doctype html><html><head><meta charset="utf-8"><title>MTD Income Tax submission evidence ${esc(taxYear)}</title><style>body{font-family:Arial,sans-serif;margin:40px;color:#17202a}h1{margin-bottom:4px}.muted{color:#667085}.status{border:1px solid #d0d5dd;border-radius:8px;padding:12px;margin:18px 0;background:#f8fafc}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:9px;border:1px solid #d0d5dd;text-align:left;font-size:12px}th{background:#f2f4f7}.note{margin-top:24px;font-size:12px}</style></head><body><h1>Making Tax Digital for Income Tax</h1><div class="muted">Submission evidence and HMRC audit record</div><p><strong>Taxpayer:</strong> ${esc(taxpayer.display_name||taxpayerId)}<br><strong>NINO:</strong> ${esc(taxpayer.nino||'Not available')}<br><strong>Tax year:</strong> ${esc(taxYear)}</p><div class="status"><strong>Final Declaration:</strong> ${esc(finalStatus)}${finalAccepted===0&&!taxYearEnded(taxYear)?`<br><span class="muted">The selected tax year has not ended, so MTD Lab correctly blocks the Income Tax return declaration.</span>`:''}</div><table><thead><tr><th>Evidence area</th><th>Accepted count</th></tr></thead><tbody>${counts.map(c=>`<tr><td>${esc(c.label)}</td><td>${esc(c.value)}</td></tr>`).join('')}</tbody></table><table><thead><tr><th>Date</th><th>Activity</th><th>Acting capacity</th><th>Status</th><th>HMRC reference</th><th>Details</th></tr></thead><tbody>${rows.length?rows.map((r:any)=>`<tr><td>${esc(r.date||'')}</td><td>${esc(r.type)}</td><td>${esc(r.actor)}</td><td>${esc(r.status)}</td><td>${esc(r.reference)}</td><td>${esc(r.detail)}</td></tr>`).join(''):'<tr><td colspan="6">No recorded submission activity for this tax year.</td></tr>'}</tbody></table><p class="note">Generated by MTD Lab from stored Making Tax Digital for Income Tax submission records, agent attribution and the latest synchronised HMRC obligation state. Keep this evidence with the taxpayer's records.</p></body></html>`
 return new NextResponse(html,{headers:{'Content-Type':'text/html; charset=utf-8','Content-Disposition':`attachment; filename="mtd-income-tax-${taxYear}-submission-evidence.html"`,'Cache-Control':'no-store'}})
}
