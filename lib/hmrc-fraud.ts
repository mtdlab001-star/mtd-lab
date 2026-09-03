function enc(value:string){return encodeURIComponent(value)}

function cookieContext(req:Request):Record<string,string>{
 const raw=req.headers.get('cookie')||''
 const part=raw.split(';').map(v=>v.trim()).find(v=>v.startsWith('mtdlab-fraud-context='))
 if(!part)return {}
 try{return JSON.parse(decodeURIComponent(part.slice('mtdlab-fraud-context='.length)))||{}}catch{return {}}
}

export function buildFraudHeaders(req:Request,form:FormData,taxpayerId:string){
  const saved=cookieContext(req)
  const forwarded=req.headers.get('x-forwarded-for')||req.headers.get('x-vercel-forwarded-for')||''
  const sandbox=process.env.HMRC_ENVIRONMENT!=='production'
  const clientIp=forwarded.split(',')[0]?.trim()||(sandbox?'127.0.0.1':'')
  const vendorPublicIp=process.env.HMRC_VENDOR_PUBLIC_IP||(sandbox?clientIp:'')
  const vendorLicenseHash=process.env.HMRC_VENDOR_LICENSE_ID_HASH||(sandbox?'sandbox':'')
  const publicPort=String(form.get('clientPublicPort')||saved.clientPublicPort||'').trim()||(sandbox?'443':'')
  const multiFactor=String(form.get('multiFactor')||saved.multiFactor||'').trim()||(sandbox?`type=OTHER&timestamp=${new Date().toISOString()}`:'')
  const browserUserAgent=String(form.get('browserUserAgent')||saved.browserUserAgent||req.headers.get('user-agent')||'').trim()
  const deviceId=String(form.get('deviceId')||saved.deviceId||'').trim()
  const screens=String(form.get('screens')||saved.screens||'').trim()
  const timezone=String(form.get('timezone')||saved.timezone||'').trim()
  const windowSize=String(form.get('windowSize')||saved.windowSize||'').trim()
  const collectedAt=new Date().toISOString()
  const headers:Record<string,string>={
    'Gov-Client-Connection-Method':'WEB_APP_VIA_SERVER',
    'Gov-Client-Browser-JS-User-Agent':browserUserAgent,
    'Gov-Client-Device-ID':deviceId,
    'Gov-Client-Multi-Factor':multiFactor,
    'Gov-Client-Public-IP':clientIp,
    'Gov-Client-Public-IP-Timestamp':collectedAt,
    'Gov-Client-Public-Port':publicPort,
    'Gov-Client-Screens':screens,
    'Gov-Client-Timezone':timezone,
    'Gov-Client-User-IDs':`mtd-lab=${enc(taxpayerId)}`,
    'Gov-Client-Window-Size':windowSize,
    'Gov-Vendor-Forwarded':vendorPublicIp&&clientIp?`by=${enc(vendorPublicIp)}&for=${enc(clientIp)}`:'',
    'Gov-Vendor-License-IDs':vendorLicenseHash?`mtd-lab=${enc(vendorLicenseHash)}`:'',
    'Gov-Vendor-Product-Name':enc('MTD Lab'),
    'Gov-Vendor-Public-IP':vendorPublicIp,
    'Gov-Vendor-Version':`mtd-lab=${enc(process.env.NEXT_PUBLIC_APP_VERSION||'0.3.0')}`
  }
  const missing=Object.entries(headers).filter(([,v])=>!v).map(([k])=>k)
  return {headers,missing}
}
