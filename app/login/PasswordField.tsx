'use client'

import {useState} from 'react'
import s from './login.module.css'

export default function PasswordField(){
  const [visible,setVisible]=useState(false)

  return <div>
    <label htmlFor="password">Password</label>
    <div className={s.inputWrap}>
      <span aria-hidden="true">▣</span>
      <input
        id="password"
        name="password"
        className={s.field}
        type={visible?'text':'password'}
        autoComplete="current-password"
        required
        placeholder="Enter your password"
      />
      <button
        className={s.eyeButton}
        type="button"
        aria-label={visible?'Hide password':'Show password'}
        aria-pressed={visible}
        onClick={()=>setVisible(value=>!value)}
      >{visible?'◉':'◎'}</button>
    </div>
  </div>
}
