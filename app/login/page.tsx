import s from './login.module.css'
import PasswordField from './PasswordField'

export default async function LoginPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const qs=await searchParams
  return <main className={s.page}>
    <div className={s.shell}>
      <section className={s.hero} aria-label="MTD Lab introduction">
        <img className={s.logo} src="/mtd-lab-logo-exact.webp" alt="MTD Lab, Making Tax Digital for Income Tax"/>
        <div className={s.benefits}>
          <div className={s.benefit}><strong>Secure</strong><span>Your data is protected with enterprise-grade security.</span></div>
          <div className={s.benefit}><strong>Compliant</strong><span>Built in line with HMRC Making Tax Digital requirements.</span></div>
          <div className={s.benefit}><strong>Efficient</strong><span>Simplify your Income Tax reporting and save valuable time.</span></div>
        </div>
      </section>
      <section className={s.panel}>
        <div className={s.card}>
          <h1>Welcome to <span>MTD Lab</span></h1>
          <p className={s.subtitle}>Sign in to access your MTD Income Tax dashboard</p>
          <form className={s.form} method="post" action="/api/auth/login">
            <input type="hidden" name="next" value={qs.next||''}/>
            <div><label htmlFor="username">Username</label><div className={s.inputWrap}><span aria-hidden="true">♙</span><input id="username" name="username" className={s.field} autoComplete="username" required placeholder="Enter your username"/></div></div>
            <PasswordField/>
            <div className={s.options}><label><input type="checkbox" name="remember"/> Remember me</label><a href="/help#sign-in">Forgot password?</a></div>
            <button className={s.button} type="submit">▣ &nbsp; Sign In</button>
          </form>
          {qs.error&&<div className={s.error}>{qs.error}</div>}
          <div className={s.rule}><span>MTD Lab – Making Tax Digital for Income Tax</span></div>
          <div id="help" className={s.help}><div className={s.helpIcon}>♬</div><div><strong>Need help?</strong><p>Find practical guides and troubleshooting support.</p><a href="/help">Open Help Centre <span aria-hidden="true">→</span></a></div></div>
        </div>
        <div className={s.copyright}>© 2026 MTD Lab. All rights reserved.</div>
      </section>
    </div>
  </main>
}
