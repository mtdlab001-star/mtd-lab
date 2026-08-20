export default async function LoginPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const qs=await searchParams
  return <main className="loginPage">
    <div className="loginShell">
      <section className="loginHero" aria-label="MTD Lab introduction">
        <img className="loginHeroLogo" src="/mtd-lab-logo.svg" alt="MTD Lab, Making Tax Digital for Income Tax"/>
        <div className="loginBenefits">
          <div><strong>Secure</strong><span>Protected access to your MTD Income Tax workspace.</span></div>
          <div><strong>Compliant</strong><span>Built around HMRC Making Tax Digital for Income Tax workflows.</span></div>
          <div><strong>Efficient</strong><span>Manage digital records, quarterly updates and year end filing in one place.</span></div>
        </div>
      </section>
      <section className="loginPanel">
        <div className="loginCard">
          <h1>Welcome to <span>MTD Lab</span></h1>
          <p className="muted">Sign in to access your MTD Income Tax dashboard.</p>
          <form className="loginForm" method="post" action="/api/auth/login">
            <div><label htmlFor="username">Username</label><input id="username" name="username" className="field" autoComplete="username" required placeholder="Enter your username"/></div>
            <div><label htmlFor="password">Password</label><input id="password" name="password" className="field" type="password" autoComplete="current-password" required placeholder="Enter your password"/></div>
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
