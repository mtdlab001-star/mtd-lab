import Link from 'next/link'
import {cookies} from 'next/headers'
import {redirect} from 'next/navigation'
import {configuredAppUsername,readAppSessionUsername} from '@/lib/app-auth'
import {supabaseAdmin} from '@/lib/supabase-admin'

export const dynamic='force-dynamic'

export default async function FirmApprovalsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const qs=await searchParams
  const jar=await cookies()
  const username=await readAppSessionUsername(jar.get('mtdlab_session')?.value)
  if(!username||username!==configuredAppUsername())redirect('/')
  const db=supabaseAdmin()
  const [{data,error},{data:bundles},{data:subscriptions},{data:clientRows}]=await Promise.all([
    db.from('accounting_firms').select('id,firm_name,company_number,arn,phone,postcode,status,created_at,app_users(id,full_name,email,username,status)').order('created_at',{ascending:false}),
    db.from('subscription_bundles').select('id,name,client_capacity').eq('is_active',true).order('sort_order'),
    db.from('firm_subscriptions').select('firm_id,status,base_capacity,addon_capacity'),
    db.from('taxpayers').select('firm_id').is('archived_at',null)
  ])
  const firms=(data||[]).filter((firm:any)=>Array.isArray(firm.app_users)?firm.app_users.length>0:Boolean(firm.app_users))
  const subscriptionByFirm=new Map((subscriptions||[]).map((row:any)=>[row.firm_id,row]))
  const activeByFirm=new Map<string,number>()
  for(const row of clientRows||[])activeByFirm.set(row.firm_id,(activeByFirm.get(row.firm_id)||0)+1)

  return <div className="shell">
    <aside className="side"><div className="brand"><img className="brandLogo" src="/mtd-lab-logo-post-login.svg" alt="MTD Lab"/></div><div className="nav"><Link href="/">Dashboard</Link><Link href="/taxpayers">Taxpayers</Link><Link className="navActive" href="/admin/firms">Firm access</Link><Link href="/billing">Plans &amp; Billing</Link></div><div className="operator">Super Admin</div></aside>
    <main className="main">
      <div className="top"><div><h1 className="pageTitle">Accounting firm access</h1><p className="muted">Approve firms and control their pre-launch client capacity.</p></div></div>
      {qs.success&&<div className="status"><strong>Updated</strong><div>{qs.success}</div></div>}
      {qs.error&&<div className="status statusError"><strong>Update failed</strong><div>{qs.error}</div></div>}
      {error&&<div className="status statusError">Unable to load firm registrations: {error.message}</div>}
      <section className="panel" style={{marginTop:24}}>
        <div className="sectionHead"><div><h2>Registration applications</h2><p className="muted">New applications remain blocked until you approve them. Approved firms can be assigned a base client bundle plus temporary add-on capacity for testing.</p></div></div>
        {firms.length?<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,340px),1fr))',gap:16,marginTop:18}}>{firms.map((firm:any)=>{
          const user=Array.isArray(firm.app_users)?firm.app_users[0]:firm.app_users
          const status=String(firm.status).replace(/^./,(c:string)=>c.toUpperCase())
          const sub:any=subscriptionByFirm.get(firm.id)
          const base=Number(sub?.base_capacity||0)
          const addons=Number(sub?.addon_capacity||0)
          const total=base+addons
          const used=activeByFirm.get(firm.id)||0
          return <article key={firm.id} style={{minWidth:0,border:'1px solid #263a5d',borderRadius:14,padding:18,background:'rgba(5,17,42,.72)',overflowWrap:'anywhere'}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',flexWrap:'wrap'}}><div><h3 style={{margin:'0 0 4px',fontSize:21}}>{firm.firm_name}</h3><div className="muted">Applied {new Date(firm.created_at).toLocaleString('en-GB')}</div></div><strong>{status}</strong></div>
            <div style={{display:'grid',gap:14,marginTop:18}}>
              <div><div className="muted" style={{marginBottom:4}}>Applicant</div><strong>{user.full_name}</strong><div>{user.email}</div><div className="muted">Username: {user.username}</div></div>
              <div><div className="muted" style={{marginBottom:4}}>HMRC / company details</div><div>ARN: {firm.arn||'Not supplied'}</div><div>Company no: {firm.company_number||'Not supplied'}</div><div>Postcode: {firm.postcode||'Not supplied'}</div></div>
            </div>
            <form method="post" action="/api/admin/firms/status" style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:20}}><input type="hidden" name="firmId" value={firm.id}/>{firm.status!=='approved'&&<button className="btn btnSmall" name="status" value="approved">Approve</button>}{firm.status!=='rejected'&&<button className="btn btnSmall" name="status" value="rejected">Reject</button>}{firm.status!=='suspended'&&firm.status==='approved'&&<button className="btn btnSmall" name="status" value="suspended">Suspend</button>}</form>
            <div style={{marginTop:22,paddingTop:18,borderTop:'1px solid #263a5d'}}>
              <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap',marginBottom:12}}><strong>Client capacity</strong><span className="muted">{used} used / {total||0} assigned</span></div>
              <form method="post" action="/api/admin/firms/subscription" style={{display:'grid',gap:12}}>
                <input type="hidden" name="firmId" value={firm.id}/>
                <label>Base bundle<select className="field" name="baseCapacity" defaultValue={String(base)}><option value="0">No base bundle</option>{(bundles||[]).map((bundle:any)=><option key={bundle.id} value={bundle.client_capacity}>{bundle.name}</option>)}</select></label>
                <label>Add-on capacity<input className="field" type="number" min="0" max="10000" step="1" name="addonCapacity" defaultValue={addons}/></label>
                <label>Subscription status<select className="field" name="subscriptionStatus" defaultValue={sub?.status||'prelaunch'}><option value="prelaunch">Pre-launch</option><option value="trial">Trial</option><option value="active">Active</option><option value="past_due">Past due</option><option value="suspended">Suspended</option><option value="cancelled">Cancelled</option></select></label>
                <button className="btn btnSmall" type="submit">Save client capacity</button>
              </form>
            </div>
          </article>
        })}</div>:<div className="empty" style={{padding:'24px 0'}}>No accounting firm registrations yet.</div>}
      </section>
    </main>
  </div>
}
