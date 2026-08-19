import crypto from 'node:crypto'

const ttlMs = 10 * 60 * 1000

export function signState(taxpayerId: string) {
  const secret = process.env.HMRC_STATE_SECRET
  if (!secret) throw new Error('HMRC_STATE_SECRET is missing')
  const payload = Buffer.from(JSON.stringify({ taxpayerId, ts: Date.now(), nonce: crypto.randomUUID() })).toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyState(value: string) {
  const secret = process.env.HMRC_STATE_SECRET
  if (!secret) throw new Error('HMRC_STATE_SECRET is missing')
  const [payload, sig] = value.split('.')
  if (!payload || !sig) throw new Error('Invalid OAuth state')
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new Error('Invalid OAuth state')
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { taxpayerId: string; ts: number }
  if (!parsed.taxpayerId || Date.now() - parsed.ts > ttlMs) throw new Error('Expired OAuth state')
  return parsed
}
