import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { currentWorkspace } from '@/lib/workspace'
import { getClientCapacity, type ClientCapacity } from '@/lib/subscription-capacity'

export const dynamic = 'force-dynamic'

export default async function TaxpayersPage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const qs = await searchParams
  const archived = qs.view === 'archived'
  const query = String(qs.q || '').trim().toLowerCase()
  let taxpayers:any[]=[]
  let unavailable=''
  let capacity:ClientCapacity|null=null
  const workspace=await currentWorkspace()
  if(!workspace) unavailable='Your accounting workspace is not available or is not approved.'
  try {
    if(workspace){
      const db=supabaseAdmin()
      const [taxpayerResult,capacityResult]=await Promise.all([
        (archived?db.from('taxpayers').select('*').eq('firm_id',workspace.firmId).not('archived_at','is',null):db.from('taxpayers').select('*').eq('firm_id',workspace.firmId).is('archived_at',null)).order('created_at',{ascending:true}),
        getClientCapacity(workspace)
      ])
      if(taxpayerResult.error)throw taxpayerResult.error
      taxpayers=taxpayerResult.data||[]
      capacity=capacityResult
    }
  } catch (error:any) {
    unavailable=error?.message||'Database configuration is temporarily unavailable.'
  }

  if(query) taxpayers=taxpayers.filter(t=>[t.display_name,t.nino,t.mtditid].some(value=>String(value||'').toLowerCase().includes(query)))

  const usagePct=capacity&&!capacity.exempt&&capacity.capacity>0?Math.min(100,Math.round((capacity.used/capacity.capacity)*100)):0
  const nearLimit=capacity&&!capacity.exempt&&capacity.capacity>0&&capacity.remaining<=Math.max(1,Math.ceil(capacity.capacity*0.2))
  const atLimit=capacity&&!capacity.exempt&&!capacity.canAdd

  return <div className="shell">
    <aside className="side">
      <div className="brand"><img className="brandLogo" src="/mtd-lab-logo-post-login.svg" alt="MTD Lab"/></div>
      <div className="nav"><Link href="/">Home</Link><Link className="navActive" href="/taxpayers">Clients</Link><Link href="/billing">Plan and billing</Link><Link href="/agents">Team and access</Link><Link href="/taxpayers/sandbox">Sandbox test area</Link></div>
      <div className="operator">Operated by Glomaxel IT Service</div>
    </aside>
    <main className="main">
      <div className="top"><div><h1 className="pageTitle">{archived?'Archived clients':'Clients'}</h1><p className="muted">{archived?'Restore a client when you need to work on their records again.':`Choose a client to review records, deadlines and submissions${workspace?` for ${workspace.firmName}`:''}.`}</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link className="btn btnSmall btnSecondary" href={archived?'/taxpayers':'/taxpayers?view=archived'}>{archived?'View current clients':'View archived clients'}</Link>{atLimit?<Link className="btn" href="/billing" title="Add client capacity before adding another client">Client limit reached</Link>:<Link className="btn" href="/taxpayers/sandbox">Add a client</Link>}</div></div>
      {unavailable&&<div className="status statusError"><strong>Taxpayer data is temporarily unavailable.</strong><div>{unavailable}</div></div>}
      {!archived&&capacity&&!capacity.exempt&&<section className="panel" style={{marginTop:20}}>
        <div className="sectionHead" style={{alignItems:'center'}}><div><h2>Client capacity</h2><p className="muted">{capacity.used} of {capacity.capacity} client spaces used · {capacity.remaining} remaining</p></div><Link className="btn btnSmall" href="/billing">Plans & Billing</Link></div>
        <div aria-label={`${capacity.used} of ${capacity.capacity} client spaces used`} style={{height:10,borderRadius:999,background:'rgba(148,163,184,.18)',overflow:'hidden',marginTop:12}}><div style={{height:'100%',width:`${usagePct}%`,background:'linear-gradient(90deg,#0ea5e9,#9333ea)',borderRadius:999}}/></div>
        {atLimit&&<div className="status statusError" style={{marginTop:14}}><strong>Client limit reached.</strong><div>You are using all {capacity.capacity} client spaces. Add capacity in Plans & Billing before adding or restoring another client.</div></div>}
        {!atLimit&&nearLimit&&<div className="status" style={{marginTop:14}}><strong>Client capacity is running low.</strong><div>You have {capacity.remaining} client {capacity.remaining===1?'space':'spaces'} remaining. You can add capacity from Plans & Billing.</div></div>}
      </section>}
      <section className="panel" style={{marginTop:24}}>
        <div className="sectionHead"><div><h2>{archived?'Archived clients':'Your clients'}</h2><p className="muted">{archived?'Open a client to review their details or restore access.':'Open a client to see their details and next required step.'}</p></div><form method="get" className="clientSearch"><label htmlFor="client-search">Find a client</label><div><input id="client-search" className="inputField" name="q" defaultValue={qs.q||''} placeholder="Name, NINO or MTD ID"/><button className="btn btnSmall" type="submit">Search</button></div>{archived&&<input type="hidden" name="view" value="archived"/>}</form></div>
        <div className="tableWrap"><table><thead><tr><th>Client</th><th>NI number</th><th>Status</th><th></th></tr></thead><tbody>{taxpayers.length?taxpayers.map(t=><tr key={t.id}><td><strong>{t.display_name}</strong></td><td className="mono">{t.nino||'Not saved'}</td><td><span className={`statusPill ${archived?'statusOpen':'statusDone'}`}>{archived?'Archived':'Active'}</span>{archived&&t.archived_at&&<div className="muted" style={{marginTop:5}}>{new Date(t.archived_at).toLocaleString('en-GB')}</div>}</td><td><Link className="btn btnSmall" href={`/taxpayers/${encodeURIComponent(t.id)}`}>Open client</Link></td></tr>):<tr><td colSpan={4} className="empty">{unavailable?'Taxpayer records cannot be loaded until database configuration is available.':query?'No clients match your search.':archived?'No archived clients.':'No clients have been added yet.'}</td></tr>}</tbody></table></div>
        <p className="muted" style={{margin:'14px 0 0'}}>Client details cannot be edited, archived or removed from this list. Open the client first to manage their record.</p>
      </section>
    </main>
  </div>
}
