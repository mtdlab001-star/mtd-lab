'use client'

import { useEffect } from 'react'

function timezone(){
 const offset=-new Date().getTimezoneOffset();const sign=offset>=0?'+':'-';const hours=String(Math.floor(Math.abs(offset)/60)).padStart(2,'0');const mins=String(Math.abs(offset)%60).padStart(2,'0');return `UTC${sign}${hours}:${mins}`
}
function getDeviceId(){const key='mtdlab-device-id';let value=localStorage.getItem(key);if(!value){value=crypto.randomUUID();localStorage.setItem(key,value)}return value}
function publicPort(){return window.location.protocol==='http:'?'80':'443'}
function multiFactor(){return `type=OTHER&timestamp=${new Date().toISOString()}`}

export default function FraudContextCookie(){
 useEffect(()=>{
  const save=()=>{
   const data={browserUserAgent:navigator.userAgent,deviceId:getDeviceId(),screens:`width=${screen.width}&height=${screen.height}&scaling-factor=${window.devicePixelRatio||1}&colour-depth=${screen.colorDepth}`,timezone:timezone(),windowSize:`width=${window.innerWidth}&height=${window.innerHeight}`,clientPublicPort:publicPort(),multiFactor:multiFactor(),doNotTrack:navigator.doNotTrack||''}
   document.cookie=`mtdlab-fraud-context=${encodeURIComponent(JSON.stringify(data))}; Path=/; Max-Age=3600; SameSite=Lax; Secure`
  }
  save();window.addEventListener('resize',save);return()=>window.removeEventListener('resize',save)
 },[])
 return null
}
