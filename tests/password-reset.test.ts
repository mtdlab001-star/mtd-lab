import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {passwordMeetsPolicy} from '../lib/password-reset.ts'

test('password reset policy requires length and mixed character classes',()=>{
  assert.equal(passwordMeetsPolicy('shortA1'),false)
  assert.equal(passwordMeetsPolicy('longbutnolowercase1'.toUpperCase()),false)
  assert.equal(passwordMeetsPolicy('Longbutnonumber'),false)
  assert.equal(passwordMeetsPolicy('GoodPassword123'),true)
})

test('forgot and reset password routes are protected against cross-site requests',()=>{
  const forgot=readFileSync('app/api/auth/forgot-password/route.ts','utf8')
  const reset=readFileSync('app/api/auth/reset-password/route.ts','utf8')
  assert.match(forgot,/isSameOriginRequest\(req\)/)
  assert.match(forgot,/createPasswordResetRequest\(req,account\)/)
  assert.match(reset,/isSameOriginRequest\(req\)/)
  assert.match(reset,/resetPasswordWithToken\(req,token,password,confirmPassword\)/)
  assert.match(reset,/cookies\.set\('mtdlab_session',''/)
})

test('app credentials can be reset without storing plaintext passwords',()=>{
  const auth=readFileSync('lib/app-auth.ts','utf8')
  assert.match(auth,/hashAppPassword/)
  assert.match(auth,/verifyPasswordHash/)
  assert.match(auth,/setStoredAppPassword/)
  assert.match(auth,/PBKDF2/)
  assert.match(auth,/session_version/)
  assert.doesNotMatch(auth,/password_hash:\s*password/)
})

test('password reset tokens are hashed, expiring, single use and private',()=>{
  const reset=readFileSync('lib/password-reset.ts','utf8')
  const migration=readFileSync('supabase/migrations/013_secure_app_password_reset.sql','utf8')
  assert.match(reset,/tokenHash=await hmacHex\(`reset-token:\$\{token\}`\)/)
  assert.match(reset,/expires_at/)
  assert.match(reset,/used_at/)
  assert.match(reset,/eq\('token_hash',tokenHash\)/)
  assert.match(migration,/app_password_reset_tokens/)
  assert.match(migration,/enable row level security/)
  assert.match(migration,/revoke all on public\.app_password_reset_tokens from anon, authenticated/)
  assert.match(migration,/app_auth_credentials/)
})
