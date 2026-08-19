import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export default async function TaxpayerPage({ params, searchParams }: { params: Promise<{id:string}>, searchParams: Promise<Record<string,string|undefined>> }) {
  const { id } = await params
  const qs = await searchParams
  let taxpayer:any = { id, display_name: id === 'demo' ? 'HMRC Sandbox Taxpayer' : id, nino:'', mtditid:'' }
  let businesses:any[]=[]; let obligations:any[]=[]; let connected=false; let syncStatus='Not synced'
  try {
    const db=supabaseAdmin()
    const [{data:t},{data:b},{data:o},{data:c},{data:s}] = await Promise.all([
      db.from('taxpayers').select('*').eq('id',id).maybeSingle(),
      db.from('hmrc_businesses').select('*').eq('taxpayer_id',id).order('created_at'),
      db.from('hmrc_obligations').select('*').eq('taxpayer_id',id).order('due_date',{ascending:true}),
      db.from('hmrc_connections').select('id').eq('taxpayer_id',id).maybeSingle(),
      db.from('hmrc_sync_runs').select('status').eq('taxpayer_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle()
    ])
    if(t) taxpayer=t; businesses=b||[]; obligations=o||[]; connected=!!c; syncStatus=s?.status==='complete'?'Complete':'Not synced'
  } catch {}
  const open = obligations.filter(o=>String(o.status).toLowerCase()==='open')
  const nextDue = open.map(o=>o.due_date).filter(Boolean).sort()[0]
  return <div className="shell"><aside className="side"><div className="brand">MTD Lab</div><div className="nav"><Link href="/">Dashboard</Link><span>Taxpayers</span><span>HMRC Connection</span><span>Synchronise HMRC</span><span>MTD Obligations</span></div><div className="operator">Operated by Glomaxel IT Service</div></aside><main className="main"><div className="top"><div><h1 style={{margin:0}}>{taxpayer.display_name}</h1><p className="muted">MTD Lab taxpayer workspace</p></div>{connected&&<span className="badge">HMRC Connected</span>}</div><div className="cards"><div className="card"><strong>{connected?'Connected':'Not connected'}</strong><span className="muted">HMRC connection</span></div><div className="card"><strong>{businesses.length}</strong><span className="muted">Businesses</span></div><div className="card"><strong>{obligations.length}</strong><span className="muted">Obligations</span></div><div className="card"><strong>{nextDue||'Not synced'}</strong><span className="muted">Next due</span></div></div><div className="two"><section className="panel"><h2>HMRC Authentication</h2><p className="muted">Government Gateway credentials stay on HMRC.</p><Link className="btn" href={`/api/hmrc/oauth/start?taxpayerId=${encodeURIComponent(id)}`}>{connected?'Reconnect to HMRC':'Connect to HMRC'}</Link></section><section className="panel"><h2>Synchronise HMRC test data</h2><form method="post" action="/api/hmrc/sync"><input type="hidden" name="taxpayerId" value={id}/><label>NINO</label><input className="field" name="nino" defaultValue={taxpayer.nino||''} required/><label>MTD Income Tax ID</label><input className="field" name="mtditid" defaultValue={taxpayer.mtditid||''} required/><button className="btn" type="submit">Synchronise now</button></form></section></div><div className="status">Synchronisation: {syncStatus}{qs.error?` · ${qs.error}`:''}</div><div className="two"><section className="panel"><h2>HMRC business income sources</h2><table><thead><tr><th>Type</th><th>Name</th><th>Business ID</th></tr></thead><tbody>{businesses.map(b=><tr key={b.id}><td>{b.business_type||''}</td><td>{b.business_name||''}</td><td>{b.business_id||''}</td></tr>)}</tbody></table></section><section className="panel"><h2>MTD obligations</h2><table><thead><tr><th>Period</th><th>Due</th><th>Status</th></tr></thead><tbody>{obligations.map(o=><tr key={o.id}><td>{o.period_start||''} to {o.period_end||''}</td><td>{o.due_date||''}</td><td>{o.status||''}</td></tr>)}</tbody></table></section></div></main></div>
}
