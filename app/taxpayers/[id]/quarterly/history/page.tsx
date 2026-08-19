import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic='force-dynamic'

function fmt(value?:string|null){if(!value)return 'Not available';return new Date(value).toLocaleString('en-GB')}
function fmtDate(value?:string|null){if(!value)return 'Not available';const d=new Date(`${value}T00:00:00`);return Number.isNaN(d.getTime())?value:d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}

export default async function HistoryPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params
 let rows:any[]=[];let unavailable=false
 try{const {data,error}=await supabaseAdmin().from('hmrc_quarterly_submissions').select('*').eq('taxpayer_id',id).order('created_at',{ascending:false});if(error)throw error;rows=data||[]}catch{unavailable=true}
 return <div className="shell"><aside className="side"><div className="brand">MTD Lab</div><div className="nav"><Link href="/">Dashboard</Link><Link href="/taxpayers">Taxpayers</Link><Link href={`/taxpayers/${id}`}>Taxpayer workspace</Link><Link href={`/taxpayers/${id}/quarterly`}>Quarterly Updates</Link><span>Submission history</span></div><div className="operator">Operated by Glomaxel IT Service</div></aside><main className="main"><div className="top"><div><h1 className="pageTitle">Quarterly submission history</h1><p className="muted">Audit trail of cumulative HMRC quarterly submission attempts.</p></div></div>{unavailable&&<div className="status statusError">Submission history is waiting for the Supabase quarterly audit migration to be applied.</div>}<section className="panel"><div className="tableWrap"><table><thead><tr><th>Created</th><th>Business</th><th>Tax year</th><th>Period end</th><th>Status</th><th>HMRC status</th><th>Correlation ID</th></tr></thead><tbody>{rows.length?rows.map(r=><tr key={r.id}><td>{fmt(r.created_at)}</td><td className="mono">{r.business_id}</td><td>{r.tax_year||''}</td><td>{fmtDate(r.period_end)}</td><td><span className={`statusPill ${r.status==='submitted'?'statusDone':'statusOpen'}`}>{r.status}</span></td><td>{r.hmrc_http_status||''}</td><td className="mono">{r.hmrc_correlation_id||''}</td></tr>):<tr><td colSpan={7} className="empty">No quarterly submissions recorded yet.</td></tr>}</tbody></table></div></section></main></div>
}
