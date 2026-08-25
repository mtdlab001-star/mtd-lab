import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

function filesWith(pattern:string,args:string[]=[]){
  const output=execFileSync('rg',['-l',pattern,...args],{encoding:'utf8'})
  return output.trim().split('\n').filter(Boolean)
}

test('all POST API routes reject cross-site requests',()=>{
  const files=filesWith('export async function POST',['app/api','-g','*.ts'])
  assert.ok(files.length>0,'Expected POST API routes to be scanned')
  for(const file of files){
    const source=readFileSync(file,'utf8')
    assert.match(source,/isSameOriginRequest\(req\)/,`${file} must call isSameOriginRequest(req)`)
  }
})

test('security headers deny framing, active objects and insecure transport',()=>{
  const middleware=readFileSync('middleware.ts','utf8')
  assert.match(middleware,/frame-ancestors 'none'/)
  assert.match(middleware,/X-Frame-Options','DENY'/)
  assert.match(middleware,/object-src 'none'/)
  assert.match(middleware,/upgrade-insecure-requests/)
  assert.match(middleware,/Strict-Transport-Security/)
  assert.match(middleware,/X-Content-Type-Options','nosniff'/)
  assert.doesNotMatch(middleware,/unsafe-eval/)
})

test('middleware only exempts explicitly known public assets',()=>{
  const middleware=readFileSync('middleware.ts','utf8')
  assert.match(middleware,/const publicAssets=new Set/)
  assert.ok(!middleware.includes('const publicAsset=/'),'Middleware must not exempt arbitrary image-extension paths')
  assert.match(middleware,/publicAssets\.has\(path\)/)
})

test('login rate limiting fails closed when its protection is unavailable',()=>{
  const source=readFileSync('lib/login-rate-limit.ts','utf8')
  assert.match(source,/if \(!rateLimitSecret\(\)\) \{\s*return \{ ipHash: '', usernameHash: '', limited: true,/s)
  assert.match(source,/catch \(error\) \{\s*console\.error\('Login rate limit check failed', error\)\s*return \{ ipHash: '', usernameHash: '', limited: true,/s)
})

test('evidence uploads verify actual file signatures',()=>{
  const source=readFileSync('app/api/digital-records/evidence/upload/route.ts','utf8')
  assert.match(source,/matchesDeclaredType/)
  assert.match(source,/uploaded file content does not match its declared file type/i)
})

test('OAuth state validation rejects malformed state before timing safe comparison',()=>{
  const source=readFileSync('lib/oauth-state.ts','utf8')
  assert.match(source,/timingSafeEqual/)
  assert.match(source,/actualBuffer\.length !== expectedBuffer\.length/)
  assert.match(source,/value\.length > 4096/)
})

test('Next.js does not expose the powered-by header',()=>{
  const config=readFileSync('next.config.mjs','utf8')
  assert.match(config,/poweredByHeader:\s*false/)
})
