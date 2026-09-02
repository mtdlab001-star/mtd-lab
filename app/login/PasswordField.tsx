'use client'

import s from './login.module.css'

export default function PasswordField(){
  return <div>
    <label htmlFor="password">Password</label>
    <div className={s.inputWrap}>
      <span aria-hidden="true">▣</span>
      <input
        id="password"
        name="password"
        className={s.field}
        type="password"
        autoComplete="current-password"
        required
        placeholder="Enter your password"
      />
    </div>
  </div>
}
