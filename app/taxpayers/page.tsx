import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { currentWorkspace } from '@/lib/workspace'
import { getClientCapacity, type ClientCapacity } from '@/lib/subscription-capacity'
import TaxpayerActions from './TaxpayerActions'

export const dynamic = 'force-dynamic'

export default async function TaxpayersPage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const qs = await searchParams
  const archived = qs.view === 'archived'
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

  const usagePct=capacity&&!capacity.exempt&&capacity.capacity>0?Math.min(100,Math.round((capacity.used/capacity.capacity)*100)):0
  const nearLimit=capacity&&!capacity.exempt&&capacity.capacity>0&&capacity.remaining<=Math.max(1,Math.ceil(capacity.capacity*0.2))
  const atLimit=capacity&&!capacity.exempt&&!capacity.canAdd

  return <div className="shell">
    <aside className="side">
      <div className="brand"><img className="brandLogo" src="/mtd-lab-logo-post-login.svg" alt="MTD Lab"/></div>
      <div className="nav"><Link href="/">Dashboard</Link><Link className="navActive" href="/taxpayers">Taxpayers</Link><Link href="/billing">Plans & Billing</Link><Link href="/agents">Agents</Link><Link href="/taxpayers/sandbox">Sandbox setup</Link></div>
      <div className="operator">Operated by Glomaxel IT Service</div>
    </aside>
    <main className="main">
      <div className="top"><div><h1 className="pageTitle">{archived?'Archived taxpayers':'Taxpayers'}</h1><p className="muted">{archived?'Archived clients remain available for restoration or permanent removal.':`Manage active HMRC MTD taxpayer workspaces${workspace?` for ${workspace.firmName}`:''}.`}</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link className="btn btnSmall" href={archived?'/taxpayers':'/taxpayers?view=archived'}>{archived?'View active clients':'View archived clients'}</Link><Link className="btn btnSmall" href="/agents">Manage agents</Link>{atLimit?<Link className="btn" href="/billing" title="Add client capacity before adding another taxpayer">Client limit reached — add capacity</Link>:<Link className="btn" href="/taxpayers/sandbox">Add HMRC sandbox taxpayer</Link>}</div></div>
      {unavailable&&<div className="status statusError"><strong>Taxpayer data is temporarily unavailable.</strong><div>{unavailable}</div></div>}
      {!archived&&capacity&&!capacity.exempt&&<section className="panel" style={{marginTop:20}}>
        <div className="sectionHead" style={{alignItems:'center'}}><div><h2>Client capacity</h2><p className="muted">{capacity.used} of {capacity.capacity} client spaces used · {capacity.remaining} remaining</p></div><Link className="btn btnSmall" href="/billing">Plans & Billing</Link></div>
        <div aria-label={`${capacity.used} of ${capacity.capacity} client spaces used`} style={{height:10,borderRadius:999,background:'rgba(148,163,184,.18)',overflow:'hidden',marginTop:12}}><div style={{height:'100%',width:`${usagePct}%`,background:'linear-gradient(90deg,#0ea5e9,#9333ea)',borderRadius:999}}/></div>
        {atLimit&&<div className="status statusError" style={{marginTop:14}}><strong>Client limit reached.</strong><div>You are using all {capacity.capacity} client spaces. Add capacity in Plans & Billing before adding or restoring another client.</div></div>}
        {!atLimit&&nearLimit&&<div className="status" style={{marginTop:14}}><strong>Client capacity is running low.</strong><div>You have {capacity.remaining} client {capacity.remaining===1?'space':'spaces'} remaining. You can add capacity from Plans & Billing.</div></div>}
      </section>}
      <div className="status"><strong>Archive is the safe default.</strong> It hides a client from active lists without deleting HMRC connections, businesses, obligations, submissions, sync runs or audit history.</div>
      <section className="panel" style={{marginTop:24}}>
        <div className="sectionHead"><div><h2>{archived?'Archived client workspaces':'Active taxpayer workspaces'}</h2><p className="muted">{archived?'Restore a client at any time, or permanently remove it after confirming the exact client name.':'Open a taxpayer, archive it safely, or use Remove only when permanent deletion is intended.'}</p></div></div>
        <div className="tableWrap"><table><thead><tr><th>Name</th><th>NINO</th><th>MTD Income Tax ID</th><th>Workspace</th><th>Client actions</th></tr></thead><tbody>{taxpayers.length?taxpayers.map(t=><tr key={t.id}><td><strong>{t.display_name}</strong>{archived&&<div className="muted">Archived {t.archived_at?new Date(t.archived_at).toLocaleString('en-GB'):''}</div>}</td><td className="mono">{t.nino||'Not saved'}</td><td className="mono">{t.mtditid||'Not saved'}</td><td><Link className="btn btnSmall" href={`/taxpayers/${encodeURIComponent(t.id)}`}>Open</Link></td><td><TaxpayerActions taxpayerId={t.id} clientName={t.display_name} archived={archived}/></td></tr>):<tr><td colSpan={5} className="empty">{unavailable?'Taxpayer records cannot be loaded until database configuration is available.':archived?'No archived clients.':'No active taxpayers found.'}</td></tr>}</tbody></table></div>
      </section>
    </main>
  </div>
}
