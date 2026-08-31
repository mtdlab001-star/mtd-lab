import s from '../login/login.module.css'

export default async function ForgotPasswordPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const qs=await searchParams
  const sent=qs.sent==='1'
  return <main className={s.page}>
    <div className={s.shell}>
      <section className={s.hero} aria-label="MTD Lab account recovery">
        <img className={s.logo} src="/mtd-lab-logo-exact.webp" alt="MTD Lab, Making Tax Digital for Income Tax"/>
        <div className={s.benefits}>
          <div className={s.benefit}><strong>Recover</strong><span>Use the account details linked to your MTD Lab sign in.</span></div>
          <div className={s.benefit}><strong>Protect</strong><span>Never share your password, HMRC credentials, codes or security tokens.</span></div>
          <div className={s.benefit}><strong>Return</strong><span>Go back to sign in once your password has been reset.</span></div>
        </div>
      </section>
      <section className={s.panel}>
        <div className={s.card}>
          <h1>Reset your <span>password</span></h1>
          <p className={s.subtitle}>Enter your MTD Lab username or email address. For security, the confirmation is the same whether or not the account exists.</p>
          {sent
            ? <div className={s.help}><div className={s.helpIcon}>✓</div><div><strong>Request received</strong><p>If the account exists, reset instructions will be sent to the registered contact or handled by the app administrator.</p><a href="/login">Back to sign in <span aria-hidden="true">→</span></a></div></div>
            : <form className={s.form} method="post" action="/api/auth/forgot-password">
                <div><label htmlFor="account">Username or email</label><div className={s.inputWrap}><span aria-hidden="true">@</span><input id="account" name="account" className={s.field} autoComplete="username" required placeholder="Enter your username or email"/></div></div>
                <button className={s.button} type="submit">Send reset instructions</button>
              </form>}
          <div className={s.rule}><span>Account recovery</span></div>
          <div id="help" className={s.help}><div className={s.helpIcon}>!</div><div><strong>Important security note</strong><p>MTD Lab will never ask you to reveal your password, Government Gateway password, authenticator code or HMRC security token in chat.</p><a href="/help#sign-in">Read sign in guidance <span aria-hidden="true">→</span></a></div></div>
        </div>
        <div className={s.copyright}>© 2026 MTD Lab. All rights reserved.</div>
      </section>
    </div>
  </main>
}
