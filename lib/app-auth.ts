import { supabaseAdmin } from '@/lib/supabase-admin'

const encoder = new TextEncoder()
const PASSWORD_HASH_PREFIX = 'pbkdf2-sha256'
const PASSWORD_HASH_ITERATIONS = 210000
const PASSWORD_HASH_BYTES = 32

type StoredAppCredential = {
  username:string
  password_hash:string
  session_version:number
}

function secret(){return process.env.MTD_SESSION_SECRET||''}

async function hmac(value:string){
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret()),{name:'HMAC',hash:'SHA-256'},false,['sign'])
  const sig=await crypto.subtle.sign('HMAC',key,encoder.encode(value))
  return Array.from(new Uint8Array(sig)).map(b=>b.toString(16).padStart(2,'0')).join('')
}

async function digest(value:string){
  return new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)))
}

function toArrayBuffer(bytes:Uint8Array){
  return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer
}

function bytesToBase64(bytes:Uint8Array){
  let binary=''
  for(const byte of bytes)binary+=String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value:string){
  const binary=atob(value)
  const bytes=new Uint8Array(binary.length)
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i)
  return bytes
}

function constantTimeBytesEqual(actual:Uint8Array,expected:Uint8Array){
  let diff=actual.length===expected.length?0:1
  const maxLength=Math.max(actual.length,expected.length)
  for(let i=0;i<maxLength;i++)diff|=(actual[i]||0)^(expected[i]||0)
  return diff===0
}

async function derivePasswordHash(password:string,salt:Uint8Array,iterations:number){
  const keyMaterial=await crypto.subtle.importKey('raw',encoder.encode(password),{name:'PBKDF2'},false,['deriveBits'])
  const derived=await crypto.subtle.deriveBits({name:'PBKDF2',salt:toArrayBuffer(salt),iterations,hash:'SHA-256'},keyMaterial,PASSWORD_HASH_BYTES*8)
  return new Uint8Array(derived)
}

export async function constantTimeEqual(actual:string,expected:string){
  const actualHash=await digest(actual)
  const expectedHash=await digest(expected)
  let diff=actual.length===expected.length?0:1
  for(let i=0;i<actualHash.length;i++) diff|=actualHash[i]^expectedHash[i]
  return diff===0
}

export async function hashAppPassword(password:string){
  const salt=crypto.getRandomValues(new Uint8Array(16))
  const hash=await derivePasswordHash(password,salt,PASSWORD_HASH_ITERATIONS)
  return `${PASSWORD_HASH_PREFIX}$${PASSWORD_HASH_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`
}

export async function verifyPasswordHash(password:string,storedHash:string){
  const [prefix,iterationsText,saltText,hashText]=storedHash.split('$')
  const iterations=Number(iterationsText)
  if(prefix!==PASSWORD_HASH_PREFIX||!Number.isFinite(iterations)||iterations<100000||!saltText||!hashText)return false
  try{
    const salt=base64ToBytes(saltText)
    const expected=base64ToBytes(hashText)
    const actual=await derivePasswordHash(password,salt,iterations)
    return constantTimeBytesEqual(actual,expected)
  }catch{
    return false
  }
}

export async function readStoredAppCredential():Promise<StoredAppCredential|null>{
  try{
    const {data,error}=await supabaseAdmin()
      .from('app_auth_credentials')
      .select('username,password_hash,session_version')
      .eq('credential_key','primary')
      .maybeSingle()
    if(error)throw error
    if(!data?.username||!data?.password_hash)return null
    return {
      username:String(data.username),
      password_hash:String(data.password_hash),
      session_version:Number(data.session_version)||0,
    }
  }catch(error){
    console.warn('Stored app credential unavailable; using configured credential',error)
    return null
  }
}

export async function setStoredAppPassword(username:string,password:string){
  const current=await readStoredAppCredential()
  const passwordHash=await hashAppPassword(password)
  const nextVersion=(current?.session_version||0)+1
  const {error}=await supabaseAdmin().from('app_auth_credentials').upsert({
    credential_key:'primary',
    username,
    password_hash:passwordHash,
    session_version:nextVersion,
    updated_at:new Date().toISOString(),
  })
  if(error)throw error
  return nextVersion
}

export async function currentAppSessionVersion(username:string){
  const stored=await readStoredAppCredential()
  if(stored&&await constantTimeEqual(username,stored.username))return stored.session_version
  return 0
}

export async function validateAppCredentials(username:string,password:string){
  const expectedUser=configuredAppUsername()
  const stored=await readStoredAppCredential()
  const activeUsername=stored?.username||expectedUser
  if(!activeUsername)return {configured:false,valid:false,username:activeUsername,sessionVersion:0}

  const validUser=await constantTimeEqual(username,activeUsername)
  if(!validUser)return {configured:true,valid:false,username:activeUsername,sessionVersion:stored?.session_version||0}

  if(stored?.password_hash){
    const valid=await verifyPasswordHash(password,stored.password_hash)
    return {configured:true,valid,username:activeUsername,sessionVersion:stored.session_version||0}
  }

  const expectedPassword=configuredAppPassword()
  if(!expectedPassword)return {configured:false,valid:false,username:activeUsername,sessionVersion:0}
  const valid=await constantTimeEqual(password,expectedPassword)
  return {configured:true,valid,username:activeUsername,sessionVersion:0}
}

export async function createAppSession(username:string,maxAgeSeconds=60*60*12,sessionVersion=0){
  if(!secret()) throw new Error('MTD_SESSION_SECRET is not configured')
  const safeMaxAge=Math.max(60*15,Math.min(maxAgeSeconds,60*60*24*30))
  const expires=Date.now()+1000*safeMaxAge
  const payload=`${username}|${expires}|${sessionVersion}`
  return `${payload}|${await hmac(payload)}`
}

export async function verifyAppSession(token?:string|null){
  if(!token||!secret()) return false
  const parts=token.split('|')
  if(parts.length!==3&&parts.length!==4)return false

  const username=parts[0]
  const expiresText=parts[1]
  const legacyToken=parts.length===3
  const sessionVersion=legacyToken?0:Number(parts[2])
  const signature=legacyToken?parts[2]:parts[3]
  const expires=Number(expiresText)
  if(!username||!Number.isFinite(expires)||expires<Date.now()||!Number.isFinite(sessionVersion)) return false

  const payload=legacyToken?`${username}|${expiresText}`:`${username}|${expiresText}|${sessionVersion}`
  const expected=await hmac(payload)
  if(signature.length!==expected.length) return false
  let diff=0
  for(let i=0;i<signature.length;i++) diff|=signature.charCodeAt(i)^expected.charCodeAt(i)
  if(diff!==0)return false

  const currentVersion=await currentAppSessionVersion(username)
  return sessionVersion===currentVersion
}

export function configuredAppUsername(){return process.env.MTD_APP_USERNAME||''}
export function configuredAppPassword(){return process.env.MTD_APP_PASSWORD||''}
export function configuredAppEmail(){return process.env.MTD_APP_EMAIL||process.env.PASSWORD_RESET_TO||''}
