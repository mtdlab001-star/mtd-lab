import Link from 'next/link'
import {cookies} from 'next/headers'
import {redirect} from 'next/navigation'
import {configuredAppUsername,readAppSessionUsername} from '@/lib/app-auth'
import {supabaseAdmin} from '@/lib/supabase-admin'

export const dynamic='force-dynamic'

export default async function FirmApprovalsPage(){
  const jar=await cookies()
  const username=await readAppSessionUsername(jar.get('mtdlab_session')?.value)
  if(!username||username!==configuredAppUsername())redirect('/')
  const db=supabaseAdmin()
  const {data,error}=await db.from('accounting_firms').select('id,firm_name,company_number,arn,phone,postcode,status,created_at,app_users(id,full_name,email,username,status)').order('created_at',{ascending:false})
  const firms=(data||[]).filter((firm:any)=>Array.isArray(firm.app_users)?firm.app_users.length>0:Boolean(firm.app_users))
  return <div className="shell">
    <aside className="side"><div className="brand"><img className="brandLogo" src="/mtd-lab-logo-post-login.svg" alt="MTD Lab"/></div><div className="nav"><Link href="/">Dashboard</Link><Link href="/taxpayers">Taxpayers</Link><Link className="navActive" href="/admin/firms">Firm access</Link></div><div className="operator">Super Admin</div></aside>
    <main className="main">
      <div className="top"><div><h1 className="pageTitle">Accounting firm access</h1><p className="muted">Approve, reject or suspend firms requesting access to MTD Lab.</p></div></div>
      {error&&<div className="status statusError">Unable to load firm registrations: {error.message}</div>}
      <section className="panel" style={{marginTop:24}}>
        <div className="sectionHead"><div><h2>Registration applications</h2><p className="muted">New applications remain blocked until you approve them.</p></div></div>
        {firms.length?<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,300px),1fr))',gap:16,marginTop:18}}>{firms.map((firm:any)=>{
          const user=Array.isArray(firm.app_users)?firm.app_users[0]:firm.app_users
          const status=String(firm.status).replace(/^./,(c:string)=>c.toUpperCase())
          return <article key={firm.id} style={{minWidth:0,border:'1px solid #263a5d',borderRadius:14,padding:18,background:'rgba(5,17,42,.72)',overflowWrap:'anywhere'}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',flexWrap:'wrap'}}><div><h3 style={{margin:'0 0 4px',fontSize:21}}>{firm.firm_name}</h3><div className="muted">Applied {new Date(firm.created_at).toLocaleString('en-GB')}</div></div><strong>{status}</strong></div>
            <div style={{display:'grid',gap:14,marginTop:18}}>
              <div><div className="muted" style={{marginBottom:4}}>Applicant</div><strong>{user.full_name}</strong><div>{user.email}</div><div className="muted">Username: {user.username}</div></div>
              <div><div className="muted" style={{marginBottom:4}}>HMRC / company details</div><div>ARN: {firm.arn||'Not supplied'}</div><div>Company no: {firm.company_number||'Not supplied'}</div><div>Postcode: {firm.postcode||'Not supplied'}</div></div>
            </div>
            <form method="post" action="/api/admin/firms/status" style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:20}}><input type="hidden" name="firmId" value={firm.id}/>{firm.status!=='approved'&&<button className="btn btnSmall" name="status" value="approved">Approve</button>}{firm.status!=='rejected'&&<button className="btn btnSmall" name="status" value="rejected">Reject</button>}{firm.status!=='suspended'&&firm.status==='approved'&&<button className="btn btnSmall" name="status" value="suspended">Suspend</button>}</form>
          </article>
        })}</div>:<div className="empty" style={{padding:'24px 0'}}>No accounting firm registrations yet.</div>}
      </section>
    </main>
  </div>
}
