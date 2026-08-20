export default async function LoginPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const qs=await searchParams
  const badgeStyle={width:76,height:76,borderRadius:'50%',margin:'14px auto 0',display:'flex',flexDirection:'column' as const,alignItems:'center',justifyContent:'center',border:'2px solid #19e4ff',background:'radial-gradient(circle at 35% 28%,#0a6f87 0%,#042437 58%,#020b17 100%)',boxShadow:'0 0 12px rgba(0,224,255,.42)',color:'#fff',lineHeight:1}
  return <main className="loginPage">
    <div className="loginShell">
      <section className="loginHero" aria-label="MTD Lab introduction">
        <img className="loginHeroLogo" src="/mtd-lab-logo-exact.webp" alt="MTD Lab, Making Tax Digital for Income Tax"/>
        <div className="loginBenefits">
          <div className="loginBenefit"><strong>Secure</strong><span>Protected access to your MTD Income Tax workspace.</span></div>
          <div className="loginBenefit loginBenefitCompliant"><strong>Compliant</strong><span>Built in line with HMRC Making Tax Digital for Income Tax requirements.</span><div style={badgeStyle} aria-label="HMRC Compliant"><span aria-hidden="true" style={{fontSize:15,color:'#fff',lineHeight:1}}>♛</span><b style={{fontSize:15,letterSpacing:'.02em',marginTop:2}}>HMRC</b><small style={{fontSize:7,fontWeight:800,letterSpacing:'.08em',marginTop:2}}>COMPLIANT</small><i aria-hidden="true" style={{fontSize:10,color:'#31f1df',fontStyle:'normal',marginTop:2}}>✓</i></div></div>
          <div className="loginBenefit"><strong>Efficient</strong><span>Manage digital records, quarterly updates and year end filing in one place.</span></div>
        </div>
      </section>
      <section className="loginPanel">
        <div className="loginCard">
          <h1>Welcome to <span>MTD Lab</span></h1>
          <p className="muted">Sign in to access your MTD Income Tax dashboard.</p>
          <form className="loginForm" method="post" action="/api/auth/login">
            <input type="hidden" name="next" value={qs.next||''}/>
            <div><label htmlFor="username">Username</label><div className="loginInputWrap"><span aria-hidden="true">♙</span><input id="username" name="username" className="field" autoComplete="username" required placeholder="Enter your username"/></div></div>
            <div><label htmlFor="password">Password</label><div className="loginInputWrap"><span aria-hidden="true">▣</span><input id="password" name="password" className="field" type="password" autoComplete="current-password" required placeholder="Enter your password"/></div></div>
            <div className="loginOptions"><label><input type="checkbox" name="remember"/> Remember me</label><span>Secure access</span></div>
            <button className="btn loginButton" type="submit">Sign In</button>
          </form>
          {qs.error&&<div className="loginError">{qs.error}</div>}
          <div className="loginRule"><span>MTD Lab, Making Tax Digital for Income Tax</span></div>
          <div className="loginHelp"><strong>Need help?</strong><p className="muted">Contact your MTD Lab administrator if you cannot access your account.</p></div>
        </div>
        <div className="loginCopyright">© 2026 MTD Lab. All rights reserved.</div>
      </section>
    </div>
  </main>
}
