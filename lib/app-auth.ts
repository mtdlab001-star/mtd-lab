const encoder = new TextEncoder()

function secret(){return process.env.MTD_SESSION_SECRET||''}

async function hmac(value:string){
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret()),{name:'HMAC',hash:'SHA-256'},false,['sign'])
  const sig=await crypto.subtle.sign('HMAC',key,encoder.encode(value))
  return Array.from(new Uint8Array(sig)).map(b=>b.toString(16).padStart(2,'0')).join('')
}

export async function createAppSession(username:string){
  if(!secret()) throw new Error('MTD_SESSION_SECRET is not configured')
  const expires=Date.now()+1000*60*60*12
  const payload=`${username}|${expires}`
  return `${payload}|${await hmac(payload)}`
}

export async function verifyAppSession(token?:string|null){
  if(!token||!secret()) return false
  const parts=token.split('|')
  if(parts.length!==3) return false
  const [username,expiresText,signature]=parts
  const expires=Number(expiresText)
  if(!username||!Number.isFinite(expires)||expires<Date.now()) return false
  const expected=await hmac(`${username}|${expiresText}`)
  if(signature.length!==expected.length) return false
  let diff=0
  for(let i=0;i<signature.length;i++) diff|=signature.charCodeAt(i)^expected.charCodeAt(i)
  return diff===0
}

export function configuredAppUsername(){return process.env.MTD_APP_USERNAME||''}
export function configuredAppPassword(){return process.env.MTD_APP_PASSWORD||''}
