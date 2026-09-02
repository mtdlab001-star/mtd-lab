import Link from 'next/link'

export default async function RegisterPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const qs=await searchParams
  const success=qs.success==='1'
  return <main style={{minHeight:'100vh',background:'linear-gradient(135deg,#020719,#07142c)',color:'#f7fbff',padding:'32px 18px'}}>
    <div style={{maxWidth:760,margin:'0 auto'}}>
      <div style={{textAlign:'center',marginBottom:24}}><img src="/mtd-lab-logo-exact.webp" alt="MTD Lab" style={{width:130,height:130,objectFit:'contain',borderRadius:'50%'}}/><h1 style={{margin:'10px 0 8px'}}>Accountant registration</h1><p style={{color:'#c7cfdf',margin:0}}>Apply for your own MTD Lab accounting firm workspace. Access is granted only after administrator approval.</p></div>
      <section style={{background:'rgba(7,20,47,.86)',border:'1px solid #263a5d',borderRadius:16,padding:28,boxShadow:'0 24px 70px rgba(0,0,0,.35)'}}>
        {success?<div><div style={{padding:18,borderRadius:10,background:'rgba(18,132,80,.2)',border:'1px solid rgba(62,210,132,.45)',marginBottom:20}}><strong>Registration received.</strong><div style={{marginTop:6,color:'#d8f5e4'}}>Your account is pending administrator approval. You cannot sign in until it has been approved.</div></div><Link href="/login" style={{color:'#42a5ff'}}>Return to sign in</Link></div>:<>
          {qs.error&&<div style={{padding:14,borderRadius:10,background:'rgba(130,25,50,.28)',border:'1px solid rgba(220,75,105,.48)',marginBottom:18,color:'#ffd2db'}}>{qs.error}</div>}
          <form method="post" action="/api/auth/register" style={{display:'grid',gap:18}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:16}}>
              <label>Full name *<input name="fullName" required autoComplete="name" style={field}/></label>
              <label>Accounting firm name *<input name="firmName" required style={field}/></label>
              <label>Email address *<input name="email" type="email" required autoComplete="email" style={field}/></label>
              <label>Telephone<input name="phone" autoComplete="tel" style={field}/></label>
              <label>Postcode<input name="postcode" autoComplete="postal-code" style={field}/></label>
              <label>Companies House number<input name="companyNumber" style={field}/></label>
              <label>Agent Reference Number (ARN)<input name="arn" style={field} placeholder="If already issued by HMRC"/></label>
              <label>Username *<input name="username" required minLength={4} maxLength={60} autoComplete="username" style={field}/></label>
              <label>Password *<input name="password" type="password" required minLength={12} autoComplete="new-password" style={field}/></label>
              <label>Confirm password *<input name="confirmPassword" type="password" required minLength={12} autoComplete="new-password" style={field}/></label>
            </div>
            <label style={{display:'flex',gap:10,alignItems:'flex-start',color:'#d8e0ee'}}><input name="terms" type="checkbox" required style={{marginTop:4}}/><span>I confirm that the information supplied is accurate and I agree that access remains subject to MTD Lab administrator approval.</span></label>
            <button type="submit" style={{height:58,border:0,borderRadius:9,color:'#fff',fontWeight:800,fontSize:17,background:'linear-gradient(90deg,#079aff,#485eff,#a813eb)',cursor:'pointer'}}>Submit registration</button>
          </form>
          <p style={{margin:'22px 0 0',color:'#b8c2d4',textAlign:'center'}}>Already registered? <Link href="/login" style={{color:'#42a5ff'}}>Sign in</Link></p>
        </>}
      </section>
    </div>
  </main>
}

const field:React.CSSProperties={display:'block',width:'100%',height:48,marginTop:7,padding:'0 12px',border:'1px solid #31486e',borderRadius:8,background:'#071329',color:'#fff',fontSize:15}
