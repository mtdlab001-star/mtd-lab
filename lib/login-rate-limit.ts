import { supabaseAdmin } from '@/lib/supabase-admin'

const WINDOW_SECONDS = 15 * 60
const IP_FAILED_LIMIT = 8
const USERNAME_FAILED_LIMIT = 5
const RETENTION_DAYS = 30

type AttemptIdentity = {
  ipHash: string
  usernameHash: string
}

type RateLimitResult = AttemptIdentity & {
  limited: boolean
  retryAfterSeconds: number
}

function rateLimitSecret() {
  return process.env.LOGIN_RATE_LIMIT_SECRET || process.env.MTD_SESSION_SECRET || ''
}

function clientIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || 'unknown'
}

async function hmacHex(value: string) {
  const secret = rateLimitSecret()
  if (!secret) throw new Error('Login rate limit secret is not configured')

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function attemptIdentity(req: Request, username: string): Promise<AttemptIdentity> {
  const normalizedUsername = username.trim().toLowerCase() || 'unknown'
  const [ipHash, usernameHash] = await Promise.all([
    hmacHex(`ip:${clientIp(req)}`),
    hmacHex(`username:${normalizedUsername}`),
  ])
  return { ipHash, usernameHash }
}

async function countFailedAttempts(ipHash: string, usernameHash: string) {
  const since = new Date(Date.now() - WINDOW_SECONDS * 1000).toISOString()
  const db = supabaseAdmin()
  const [ipAttempts, usernameAttempts] = await Promise.all([
    db.from('app_login_attempts').select('id', { count: 'exact', head: true }).eq('success', false).eq('ip_hash', ipHash).gte('created_at', since),
    db.from('app_login_attempts').select('id', { count: 'exact', head: true }).eq('success', false).eq('username_hash', usernameHash).gte('created_at', since),
  ])

  if (ipAttempts.error) throw ipAttempts.error
  if (usernameAttempts.error) throw usernameAttempts.error

  return {
    ipCount: ipAttempts.count || 0,
    usernameCount: usernameAttempts.count || 0,
  }
}

export async function assessLoginRateLimit(req: Request, username: string): Promise<RateLimitResult> {
  if (!rateLimitSecret()) {
    return { ipHash: '', usernameHash: '', limited: true, retryAfterSeconds: 60 }
  }

  try {
    const identity = await attemptIdentity(req, username)
    const { ipCount, usernameCount } = await countFailedAttempts(identity.ipHash, identity.usernameHash)
    const limited = ipCount >= IP_FAILED_LIMIT || usernameCount >= USERNAME_FAILED_LIMIT

    return {
      ...identity,
      limited,
      retryAfterSeconds: limited ? WINDOW_SECONDS : 0,
    }
  } catch (error) {
    console.error('Login rate limit check failed', error)
    return { ipHash: '', usernameHash: '', limited: true, retryAfterSeconds: 60 }
  }
}

export async function recordLoginAttempt(req: Request, username: string, success: boolean, reason: string) {
  if (!rateLimitSecret()) return

  try {
    const { ipHash, usernameHash } = await attemptIdentity(req, username)
    const userAgent = (req.headers.get('user-agent') || '').slice(0, 240)
    const { error } = await supabaseAdmin().from('app_login_attempts').insert({
      ip_hash: ipHash,
      username_hash: usernameHash,
      success,
      reason,
      user_agent: userAgent || null,
    })
    if (error) throw error
  } catch (error) {
    console.error('Login attempt audit failed', error)
  }
}

export async function pruneLoginAttemptAudit() {
  try {
    const before = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const { error } = await supabaseAdmin().from('app_login_attempts').delete().lt('created_at', before)
    if (error) throw error
  } catch (error) {
    console.warn('Login attempt audit pruning skipped', error)
  }
}
