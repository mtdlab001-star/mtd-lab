import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'
import TaxpayerSidebar from '@/app/components/TaxpayerSidebar'
import { incomeSourceLabel, incomeSourceLifecycleLabel, incomeSourceStatus, incomeSourceType, incomeSourceTypeFromBusinessId, type MtdIncomeSourceType } from '@/lib/mtd-income-source'
import { quarterlyPeriodLabel } from '@/lib/mtd-quarterly-periods'
import { currentWorkspace } from '@/lib/workspace'

export const dynamic='force-dynamic'

function accountingType(b:any){const r=b.raw||{};return r.accountingType||r.accountingMethod||r.accountingBasis||'Not supplied'}
function quarterlyType(b:any){const r=b.raw||{};return r.quarterlyPeriodType||r.quarterlyType||r.quarterlyReportingType||r.quarterlyPeriod||''}

export default async function BusinessesPage({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<Record<string,string|undefined>>}){
 const {id}=await params;const qs=await searchParams;const workspace=await currentWorkspace();if(!workspace)notFound();const db=supabaseAdmin()
 const [{data:taxpayer},{data:businesses},{data:obligations}]=await Promise.all([
  db.from('taxpayers').select('*').eq('id',id).eq('firm_id',workspace.firmId).maybeSingle(),
  db.from('hmrc_businesses').select('*').eq('firm_id',workspace.firmId).eq('taxpayer_id',id).order('created_at'),
  db.from('hmrc_obligations').select('business_id').eq('firm_id',workspace.firmId).eq('taxpayer_id',id).not('business_id','is',null)
 ])
 if(!taxpayer)notFound()
 const view=qs.type||'all';const all=businesses||[]
 const sourceTypes=Array.from(new Set([...(businesses||[]).map((b:any)=>incomeSourceType(b)),...(obligations||[]).map((o:any)=>incomeSourceTypeFromBusinessId(o.business_id))])) as MtdIncomeSourceType[]
 const visible=view==='uk-property'?all.filter((b:any)=>incomeSourceType(b)==='uk-property'):view==='foreign-property'?all.filter((b:any)=>incomeSourceType(b)==='foreign-property'):view==='self-employment'?all.filter((b:any)=>incomeSourceType(b)==='self-employment'):all
 const title=view==='uk-property'?'UK Property Businesses':view==='foreign-property'?'Foreign Property Business':view==='self-employment'?'Self Employment Businesses':'All Businesses'
 const active=view==='uk-property'?'property':view==='foreign-property'?'foreign-property':view==='self-employment'?'self-employment':'businesses'
 return <div className="shell"><TaxpayerSidebar taxpayerId={id} active={active} sourceTypes={sourceTypes}/><main className="main"><div className="top"><div><h1 className="pageTitle">{title}</h1><p className="muted">Manage MTD Income Tax income sources and retrieve information from HMRC.</p></div><Link className="btn btnSmall" href={`/taxpayers/${id}`}>← Back</Link></div>
 {process.env.HMRC_ENVIRONMENT!=='production'&&<section className="panel" style={{marginTop:20}}><div className="sectionHead"><div><h2>HMRC sandbox property setup</h2><p className="muted">Create one UK Property and one Foreign Property test business through HMRC Self Assessment Test Support. HMRC removes test businesses after seven days.</p></div><span className="badge">Sandbox only</span></div>{qs.testBusinessCreated&&<div className="status"><strong>{qs.testBusinessCreated==='uk-property'?'UK Property':'Foreign Property'} test business created.</strong><div>Retrieve businesses to synchronise the new HMRC income source and obligations.</div>{qs.correlationId&&<div className="mono muted">Correlation ID: {qs.correlationId}</div>}</div>}{qs.testBusinessError&&<div className="status statusError"><strong>HMRC test business was not created.</strong><div>{qs.testBusinessError}</div></div>}<div style={{display:'flex',gap:8,flexWrap:'wrap'}}><form method="post" action="/api/hmrc/test-support/business"><input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="businessType" value="uk-property"/><button className="btn btnSmall" type="submit">Create UK Property test business</button></form><form method="post" action="/api/hmrc/test-support/business"><input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="businessType" value="foreign-property"/><button className="btn btnSmall" type="submit">Create Foreign Property test business</button></form></div></section>}
 <section className="panel" style={{marginTop:20}}><div className="sectionHead"><div><h2>Business income sources</h2><p className="muted">HMRC income sources currently stored for {taxpayer.display_name||id}.</p></div><form method="post" action="/api/hmrc/sync"><input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="nino" value={taxpayer.nino||''}/><input type="hidden" name="mtditid" value={taxpayer.mtditid||''}/><button className="btn btnSmall" type="submit">↻ Retrieve Businesses</button></form></div><div className="tableWrap"><table><thead><tr><th>Business Details</th><th>Business ID</th><th>Accounting Type</th><th>Quarterly periods</th><th>Lifecycle</th><th>Status</th><th>Action</th></tr></thead><tbody>{visible.length?visible.map((b:any)=><tr key={b.id}><td><strong>{b.business_name||'Unnamed business'}</strong><div className="muted">{incomeSourceLabel(b)}</div></td><td className="mono">{b.business_id||''}</td><td>{accountingType(b)}</td><td><strong>{quarterlyPeriodLabel(quarterlyType(b))}</strong><div className="muted">Locked after the first quarterly update for the tax year.</div></td><td><span className="muted">{incomeSourceLifecycleLabel(b)}</span></td><td><span className={`statusPill ${incomeSourceStatus(b)==='Active'?'statusDone':'statusOpen'}`}>{incomeSourceStatus(b)}</span></td><td><Link className="btn btnSmall" href={`/taxpayers/${id}/quarterly?businessId=${encodeURIComponent(b.business_id||'')}`}>View obligations</Link></td></tr>):<tr><td colSpan={7} className="empty">No matching MTD Income Tax income sources were returned by HMRC.</td></tr>}</tbody></table></div></section>
 </main></div>
}