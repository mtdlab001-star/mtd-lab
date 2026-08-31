import s from '../login/login.module.css'

export default async function ResetPasswordPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const qs=await searchParams
  const token=qs.token||''
  const success=qs.success==='1'
  const error=qs.error||''
  return <main className={s.page}>
    <div className={s.shell}>
      <section className={s.hero} aria-label="MTD Lab password reset">
        <img className={s.logo} src="/mtd-lab-logo-exact.webp" alt="MTD Lab, Making Tax Digital for Income Tax"/>
        <div className={s.benefits}>
          <div className={s.benefit}><strong>Choose</strong><span>Use a new password that has not been used elsewhere.</span></div>
          <div className={s.benefit}><strong>Protect</strong><span>Do not share the reset link, your password or HMRC credentials.</span></div>
          <div className={s.benefit}><strong>Sign in</strong><span>Return to MTD Lab once the password has been updated.</span></div>
        </div>
      </section>
      <section className={s.panel}>
        <div className={s.card}>
          {success
            ? <>
                <h1>Password reset <span>complete</span></h1>
                <p className={s.subtitle}>Your password has been updated. Existing MTD Lab sessions using the previous credential are no longer valid.</p>
                <div className={s.help}><div className={s.helpIcon}>✓</div><div><strong>You can sign in now</strong><p>Use your username and the new password on the sign in page.</p><a href="/login">Back to sign in <span aria-hidden="true">→</span></a></div></div>
              </>
            : <>
                <h1>Set a new <span>password</span></h1>
                <p className={s.subtitle}>Use at least 12 characters with uppercase, lowercase and a number.</p>
                {error&&<div className={s.error}>{error}</div>}
                {token
                  ? <form className={s.form} method="post" action="/api/auth/reset-password">
                      <input type="hidden" name="token" value={token}/>
                      <div><label htmlFor="password">New password</label><div className={s.inputWrap}><span aria-hidden="true">▣</span><input id="password" name="password" type="password" className={s.field} autoComplete="new-password" required minLength={12} placeholder="Enter a new password"/></div></div>
                      <div><label htmlFor="confirmPassword">Confirm new password</label><div className={s.inputWrap}><span aria-hidden="true">▣</span><input id="confirmPassword" name="confirmPassword" type="password" className={s.field} autoComplete="new-password" required minLength={12} placeholder="Confirm the new password"/></div></div>
                      <button className={s.button} type="submit">Update password</button>
                    </form>
                  : <div className={s.help}><div className={s.helpIcon}>!</div><div><strong>Reset link missing</strong><p>Start again from the forgot password page and use the latest reset link.</p><a href="/forgot-password">Request a new link <span aria-hidden="true">→</span></a></div></div>}
              </>}
          <div className={s.rule}><span>Password security</span></div>
          <div id="help" className={s.help}><div className={s.helpIcon}>!</div><div><strong>Security reminder</strong><p>MTD Lab will never ask you to reveal your password, Government Gateway password, authenticator code or HMRC security token in chat.</p><a href="/help#sign-in">Read sign in guidance <span aria-hidden="true">→</span></a></div></div>
        </div>
        <div className={s.copyright}>© 2026 MTD Lab. All rights reserved.</div>
      </section>
    </div>
  </main>
}
