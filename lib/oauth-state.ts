import crypto from 'node:crypto'

const ttlMs = 10 * 60 * 1000

export function signState(taxpayerId: string, agentId?: string | null) {
  const secret = process.env.HMRC_STATE_SECRET
  if (!secret) throw new Error('HMRC_STATE_SECRET is missing')
  const payload = Buffer.from(JSON.stringify({ taxpayerId, agentId: agentId || null, ts: Date.now(), nonce: crypto.randomUUID() })).toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyState(value: string) {
  const secret = process.env.HMRC_STATE_SECRET
  if (!secret) throw new Error('HMRC_STATE_SECRET is missing')
  if (value.length > 4096) throw new Error('Invalid OAuth state')
  const parts = value.split('.')
  if (parts.length !== 2) throw new Error('Invalid OAuth state')
  const [payload, sig] = parts
  if (!payload || !sig) throw new Error('Invalid OAuth state')
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  const actualBuffer = Buffer.from(sig)
  const expectedBuffer = Buffer.from(expected)
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) throw new Error('Invalid OAuth state')
  let parsed: { taxpayerId?: string; agentId?: string | null; ts?: number }
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    throw new Error('Invalid OAuth state')
  }
  if (!parsed.taxpayerId || typeof parsed.ts !== 'number' || !Number.isFinite(parsed.ts)) throw new Error('Invalid OAuth state')
  if (parsed.agentId !== undefined && parsed.agentId !== null && typeof parsed.agentId !== 'string') throw new Error('Invalid OAuth state')
  const age = Date.now() - parsed.ts
  if (age < -60_000 || age > ttlMs) throw new Error('Expired OAuth state')
  return { taxpayerId: parsed.taxpayerId, agentId: parsed.agentId || null, ts: parsed.ts }
}
