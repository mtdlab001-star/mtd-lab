import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
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

test('Next.js is pinned to the patched maintenance security release',()=>{
  const pkg=JSON.parse(readFileSync('package.json','utf8'))
  assert.equal(pkg.dependencies.next,'15.5.24')
})

test('Excel template uploads validate xlsx files before parsing',()=>{
  const source=readFileSync('app/api/templates/upload/route.ts','utf8')
  assert.match(source,/function isXlsxFile/)
  assert.match(source,/file\.name\.toLowerCase\(\)\.endsWith\('\.xlsx'\)/)
  assert.match(source,/buffer\[0\]===0x50&&buffer\[1\]===0x4b&&buffer\[2\]===0x03&&buffer\[3\]===0x04/)
  assert.match(source,/if\(!isXlsxFile\(file,uploadBuffer\)\)throw new Error/)
})

test('HMRC redirects do not expose raw response payloads in query strings',()=>{
  const calculationRoute=readFileSync('app/api/hmrc/calculations/retrieve/route.ts','utf8')
  const quarterlyRoute=readFileSync('app/api/hmrc/quarterly/submit/route.ts','utf8')

  assert.doesNotMatch(calculationRoute,/searchParams\.set\('result'/)
  assert.doesNotMatch(quarterlyRoute,/searchParams\.set\('hmrcErrors'/)
  assert.match(quarterlyRoute,/searchParams\.set\('submissionId'/)

  const scan=spawnSync('rg',[
    "searchParams\\.set\\('(result|hmrcErrors|financialResult|lossResult)'",
    'app/api/hmrc',
    '-g',
    '*.ts',
  ],{encoding:'utf8'})
  assert.equal(scan.status,1,scan.stdout || scan.stderr)
})
