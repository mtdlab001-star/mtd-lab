'use client'

import { useEffect, useState } from 'react'

function timezone(){
 const offset=-new Date().getTimezoneOffset();const sign=offset>=0?'+':'-';const hours=String(Math.floor(Math.abs(offset)/60)).padStart(2,'0');const mins=String(Math.abs(offset)%60).padStart(2,'0');return `UTC${sign}${hours}:${mins}`
}
function getDeviceId(){const key='mtdlab-device-id';let value=localStorage.getItem(key);if(!value){value=crypto.randomUUID();localStorage.setItem(key,value)}return value}

export default function FraudContextFields(){
 const [ready,setReady]=useState(false);const [data,setData]=useState<Record<string,string>>({})
 useEffect(()=>{
  setData({browserUserAgent:navigator.userAgent,deviceId:getDeviceId(),screens:`width=${screen.width}&height=${screen.height}&scaling-factor=${window.devicePixelRatio||1}&colour-depth=${screen.colorDepth}`,timezone:timezone(),windowSize:`width=${window.innerWidth}&height=${window.innerHeight}`,doNotTrack:navigator.doNotTrack||''});setReady(true)
 },[])
 return <div className="status"><strong>HMRC fraud prevention context: {ready?'ready':'collecting...'}</strong><div className="muted">Browser and device values are collected for this HMRC request. Server and vendor values are added by MTD Lab.</div>{Object.entries(data).map(([k,v])=><input key={k} type="hidden" name={k} value={v}/>)}</div>
}
