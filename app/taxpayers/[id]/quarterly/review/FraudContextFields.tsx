'use client'

import { useEffect, useState } from 'react'

function timezone(){
  const offset=-new Date().getTimezoneOffset()
  const sign=offset>=0?'+':'-'
  const hours=String(Math.floor(Math.abs(offset)/60)).padStart(2,'0')
  const mins=String(Math.abs(offset)%60).padStart(2,'0')
  return `UTC${sign}${hours}:${mins}`
}

function getDeviceId(){
  const key='mtdlab-device-id'
  let value=localStorage.getItem(key)
  if(!value){ value=crypto.randomUUID(); localStorage.setItem(key,value) }
  return value
}

export default function FraudContextFields(){
  const [ready,setReady]=useState(false)
  const [data,setData]=useState<Record<string,string>>({})
  useEffect(()=>{
    const screenInfo=`width=${screen.width}&height=${screen.height}&scaling-factor=${window.devicePixelRatio||1}&colour-depth=${screen.colorDepth}`
    const windowSize=`width=${window.innerWidth}&height=${window.innerHeight}`
    setData({
      browserUserAgent:navigator.userAgent,
      deviceId:getDeviceId(),
      screens:screenInfo,
      timezone:timezone(),
      windowSize,
      doNotTrack:navigator.doNotTrack||''
    })
    setReady(true)
  },[])
  return <div className="status"><strong>Fraud prevention context: {ready?'browser data collected':'collecting...'}</strong><div className="muted">MTD Lab is collecting the browser and device values required for HMRC web application fraud prevention headers. Network and vendor values will be added by the server at submission time.</div>{Object.entries(data).map(([k,v])=><input key={k} type="hidden" name={k} value={v}/>)}</div>
}
