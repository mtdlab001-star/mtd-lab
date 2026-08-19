import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic='force-dynamic'

function isProperty(b:any){const t=String(b.business_type||'').toLowerCase();const r=JSON.stringify(b.raw||{}).toLowerCase();return t.includes('property')||r.includes('property')}
function isSelfEmployment(b:any){return !isProperty(b)}
function accountingType(b:any){const r=b.raw||{};return r.accountingType||r.accountingMethod||r.accountingBasis||'Not supplied'}
function statusFor(b:any){const r=b.raw||{};return r.cessationDate||r.endDate?'Inactive':'Active'}

export default async function BusinessesPage({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<Record<string,string|undefined>>}){
 const {id}=await params;const qs=await searchParams;const db=supabaseAdmin()
 const [{data:taxpayer},{data:businesses}]=await Promise.all([
  db.from('taxpayers').select('*').eq('id',id).maybeSingle(),
  db.from('hmrc_businesses').select('*').eq('taxpayer_id',id).order('created_at')
 ])
 const view=qs.type||'all'
 const all=businesses||[]
 const visible=view==='property'?all.filter(isProperty):view==='self-employment'?all.filter(isSelfEmployment):all
 const title=view==='property'?'UK Property Businesses':view==='self-employment'?'Self Employment Businesses':'All Businesses'
 return <div className="shell"><aside className="side"><div className="brand">MTD Lab</div><div className="nav"><Link href="/">Dashboard</Link><Link href="/taxpayers">Taxpayers</Link><Link href={`/taxpayers/${id}`}>Taxpayer Overview</Link><span>Income Sources</span><Link href={`/taxpayers/${id}/businesses`}>All Businesses</Link><Link href={`/taxpayers/${id}/businesses?type=self-employment`}>Self Employment</Link><Link href={`/taxpayers/${id}/businesses?type=property`}>UK Property</Link><Link href={`/taxpayers/${id}/quarterly`}>Quarterly Updates</Link></div><div className="operator">Operated by Glomaxel IT Service</div></aside><main className="main"><div className="top"><div><h1 className="pageTitle">{title}</h1><p className="muted">Manage business details and retrieve information from HMRC.</p></div><Link className="btn btnSmall" href={`/taxpayers/${id}`}>← Back</Link></div>
 <section className="panel" style={{marginTop:20}}><div className="sectionHead"><div><h2>Business income sources</h2><p className="muted">HMRC businesses currently stored for {taxpayer?.display_name||id}.</p></div><form method="post" action="/api/hmrc/sync"><input type="hidden" name="taxpayerId" value={id}/><input type="hidden" name="nino" value={taxpayer?.nino||''}/><input type="hidden" name="mtditid" value={taxpayer?.mtditid||''}/><button className="btn btnSmall" type="submit">↻ Retrieve Businesses</button></form></div><div className="tableWrap"><table><thead><tr><th>Business Details</th><th>Business ID</th><th>Accounting Type</th><th>Status</th><th>Action</th></tr></thead><tbody>{visible.length?visible.map((b:any)=><tr key={b.id}><td><strong>{b.business_name||'Unnamed business'}</strong><div className="muted">{isProperty(b)?'UK Property':'Self Employment'}</div></td><td className="mono">{b.business_id||''}</td><td>{accountingType(b)}</td><td><span className={`statusPill ${statusFor(b)==='Active'?'statusDone':'statusOpen'}`}>{statusFor(b)}</span></td><td><Link className="btn btnSmall" href={`/taxpayers/${id}/quarterly?businessId=${encodeURIComponent(b.business_id||'')}`}>View obligations</Link></td></tr>):<tr><td colSpan={5} className="empty">No {view==='property'?'UK property':view==='self-employment'?'self employment':'business'} income sources were returned by HMRC.</td></tr>}</tbody></table></div></section>
 </main></div>
}
