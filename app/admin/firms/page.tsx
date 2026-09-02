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
  const firms=data||[]
  return <div className="shell">
    <aside className="side"><div className="brand"><img className="brandLogo" src="/mtd-lab-logo-post-login.svg" alt="MTD Lab"/></div><div className="nav"><Link href="/">Dashboard</Link><Link href="/taxpayers">Taxpayers</Link><Link className="navActive" href="/admin/firms">Firm access</Link></div><div className="operator">Super Admin</div></aside>
    <main className="main">
      <div className="top"><div><h1 className="pageTitle">Accounting firm access</h1><p className="muted">Approve, reject or suspend firms requesting access to MTD Lab.</p></div></div>
      {error&&<div className="status statusError">Unable to load firm registrations: {error.message}</div>}
      <section className="panel" style={{marginTop:24}}>
        <div className="sectionHead"><div><h2>Registration applications</h2><p className="muted">New applications remain blocked until you approve them.</p></div></div>
        <div className="tableWrap"><table><thead><tr><th>Firm</th><th>Applicant</th><th>HMRC / company details</th><th>Status</th><th>Action</th></tr></thead><tbody>{firms.length?firms.map((firm:any)=>{
          const user=Array.isArray(firm.app_users)?firm.app_users[0]:firm.app_users
          return <tr key={firm.id}><td><strong>{firm.firm_name}</strong><div className="muted">Applied {new Date(firm.created_at).toLocaleString('en-GB')}</div></td><td>{user?<><strong>{user.full_name}</strong><div>{user.email}</div><div className="muted">Username: {user.username}</div></>:'No applicant record'}</td><td><div>ARN: {firm.arn||'Not supplied'}</div><div>Company no: {firm.company_number||'Not supplied'}</div><div>Postcode: {firm.postcode||'Not supplied'}</div></td><td><strong>{String(firm.status).replace(/^./,(c:string)=>c.toUpperCase())}</strong></td><td><form method="post" action="/api/admin/firms/status" style={{display:'flex',gap:8,flexWrap:'wrap'}}><input type="hidden" name="firmId" value={firm.id}/>{firm.status!=='approved'&&<button className="btn btnSmall" name="status" value="approved">Approve</button>}{firm.status!=='rejected'&&<button className="btn btnSmall" name="status" value="rejected">Reject</button>}{firm.status!=='suspended'&&firm.status==='approved'&&<button className="btn btnSmall" name="status" value="suspended">Suspend</button>}</form></td></tr>
        }):<tr><td colSpan={5} className="empty">No accounting firm registrations yet.</td></tr>}</tbody></table></div>
      </section>
    </main>
  </div>
}
