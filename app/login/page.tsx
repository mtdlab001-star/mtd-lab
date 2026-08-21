import s from './login.module.css'

export default async function LoginPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const qs=await searchParams
  const hmrcMark=<div className={s.hmrc} aria-label="HMRC Compliant"><span aria-hidden="true">♛</span><b>HMRC</b><small>COMPLIANT</small><i aria-hidden="true">✓</i></div>
  return <main className={s.page}>
    <div className={s.shell}>
      <section className={s.hero} aria-label="MTD Lab introduction">
        <img className={s.logo} src="/mtd-lab-login-wordmark.svg" alt="MTD Lab, Making Tax Digital for Income Tax"/>
        <div className={s.benefits}>
          <div className={s.benefit}><div className={s.benefitIcon}>♢</div><strong>Secure</strong><span>Enterprise-grade security to keep your data safe and protected.</span></div>
          <div className={s.benefit}><div className={s.benefitIcon}>☁</div><strong>Compliant</strong><span>Built in line with HMRC Making Tax Digital requirements.</span>{hmrcMark}</div>
          <div className={s.benefit}><div className={s.benefitIcon}>ϟ</div><strong>Efficient</strong><span>Simplify reporting, manage records and save valuable time.</span></div>
        </div>
      </section>
      <section className={s.panel}>
        <div className={s.card}>
          <h1>Welcome to <span>MTD Lab</span></h1>
          <p className={s.subtitle}>Sign in to access your MTD Income Tax dashboard.</p>
          <form className={s.form} method="post" action="/api/auth/login">
            <input type="hidden" name="next" value={qs.next||''}/>
            <div><label htmlFor="username">Username</label><div className={s.inputWrap}><span aria-hidden="true">♙</span><input id="username" name="username" className={s.field} autoComplete="username" required placeholder="Enter your username"/></div></div>
            <div><label htmlFor="password">Password</label><div className={s.inputWrap}><span aria-hidden="true">▣</span><input id="password" name="password" className={s.field} type="password" autoComplete="current-password" required placeholder="Enter your password"/></div></div>
            <div className={s.options}><label><input type="checkbox" name="remember"/> Remember me</label><a href="#help">Forgot password?</a></div>
            <button className={s.button} type="submit">▣ &nbsp; Sign In</button>
          </form>
          {qs.error&&<div className={s.error}>{qs.error}</div>}
          <div className={s.rule}><span>MTD Lab, Making Tax Digital for Income Tax</span></div>
          <div id="help" className={s.help}><div className={s.helpIcon}>◉</div><div><strong>Need help?</strong><p>Contact your MTD Lab administrator or visit our help centre for guides and support.</p><a href="mailto:support@mtdlab.co.uk">Help Centre →</a></div></div>
        </div>
        <div className={s.copyright}>© 2026 MTD Lab. All rights reserved.</div>
      </section>
    </div>
  </main>
}
