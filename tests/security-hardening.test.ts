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
  const config=readFileSync('lib/supabase-admin.ts','utf8')
  assert.match(source,/function hasAuditStorage\(\) \{/)
  assert.match(source,/supabaseServerConfig\(\)\.missing\.length === 0/)
  assert.match(config,/DEFAULT_SUPABASE_URL = 'https:\/\/zpvfjabjqonnezqsztzp\.supabase\.co'/)
  assert.match(config,/NEXT_PUBLIC_SUPABASE_URL \|\| process\.env\.SUPABASE_URL/)
  assert.match(config,/SUPABASE_SERVICE_ROLE_KEY \|\| process\.env\.SUPABASE_SERVICE_KEY/)
  assert.match(config,/missing\.join\(', '\)/)
  assert.match(source,/if \(!rateLimitSecret\(\) \|\| !hasAuditStorage\(\)\) \{\s*return \{ ipHash: '', usernameHash: '', limited: true,/s)
  assert.match(source,/if \(!rateLimitSecret\(\) \|\| !hasAuditStorage\(\)\) return/)
  assert.match(source,/catch \(error\) \{\s*console\.error\('Login rate limit check failed', error\)\s*return \{ ipHash: '', usernameHash: '', limited: true,/s)
})

test('taxpayer and agent pages surface Supabase configuration failures',()=>{
  const taxpayers=readFileSync('app/taxpayers/page.tsx','utf8')
  const agents=readFileSync('app/agents/page.tsx','utf8')
  const taxpayerAgents=readFileSync('app/taxpayers/[id]/agents/page.tsx','utf8')

  assert.match(taxpayers,/Taxpayer data is temporarily unavailable/)
  assert.match(taxpayers,/error\?\.message/)
  assert.match(taxpayers,/Taxpayer records cannot be loaded until database configuration is available/)
  assert.match(agents,/Agent data is temporarily unavailable/)
  assert.match(agents,/error\?\.message/)
  assert.match(taxpayerAgents,/Agent authorisation data is temporarily unavailable/)
  assert.match(taxpayerAgents,/error\?\.message/)
})

test('login rate limiting does not trap valid credentials behind stale failures',()=>{
  const route=readFileSync('app/api/auth/login/route.ts','utf8')
  const limiter=readFileSync('lib/login-rate-limit.ts','utf8')
  assert.match(route,/valid=await constantTimeEqual\(password,expectedPassword\)/)
  assert.match(route,/if\(rateLimit\.limited&&!valid\)/)
  assert.match(limiter,/\.eq\('reason', 'invalid_credentials'\)\.eq\('ip_hash'/)
  assert.match(limiter,/\.eq\('reason', 'invalid_credentials'\)\.eq\('username_hash'/)
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

test('delegated HMRC filing uses the authorised agent ASA connection',()=>{
  const connection=readFileSync('lib/hmrc-connection.ts','utf8')
  assert.match(connection,/agent_hmrc_connections/)
  assert.match(connection,/getValidAgentHmrcAccessToken/)
  assert.match(connection,/getHmrcAccessTokenForActingCapacity/)

  const quarterlyRoute=readFileSync('app/api/hmrc/quarterly/submit/route.ts','utf8')
  const finalRoute=readFileSync('app/api/hmrc/calculations/final-declaration/route.ts','utf8')
  const triggerRoute=readFileSync('app/api/hmrc/calculations/trigger/route.ts','utf8')
  const retrieveRoute=readFileSync('app/api/hmrc/calculations/retrieve/route.ts','utf8')

  assert.match(quarterlyRoute,/resolveConnectedAgentForPermission\(taxpayerId,'can_submit_quarterly',requestedAgentId\)/)
  assert.match(quarterlyRoute,/getHmrcAccessTokenForActingCapacity\(taxpayerId,actingAgentId\)/)

  for(const source of [finalRoute,triggerRoute,retrieveRoute]){
    assert.match(source,/agentCan\(taxpayerId,actingAgentId,/)
    assert.match(source,/getHmrcAccessTokenForActingCapacity\(taxpayerId,actingAgentId\)/)
  }
})

test('quarterly submissions recheck eligibility and prevent duplicate transmission',()=>{
  const page=readFileSync('app/taxpayers/[id]/quarterly/page.tsx','utf8')
  const prepareRoute=readFileSync('app/api/hmrc/quarterly/prepare/route.ts','utf8')
  const submitRoute=readFileSync('app/api/hmrc/quarterly/submit/route.ts','utf8')
  const migration=readFileSync('supabase/migrations/012_prevent_duplicate_quarterly_submissions.sql','utf8')

  assert.match(page,/!latestSubmission\(selectedPeriodEnd\)/)
  assert.match(prepareRoute,/quarterlySubmissionEligibility/)
  assert.match(prepareRoute,/currentWorkspace/)
  assert.match(prepareRoute,/db\.from\('taxpayers'\)\.select\('id'\)\.eq\('id',taxpayerId\)\.eq\('firm_id',workspace\.firmId\)/)
  assert.match(prepareRoute,/db\.from\('hmrc_businesses'\).*\.eq\('firm_id',workspace\.firmId\)/)
  assert.match(prepareRoute,/db\.from\('hmrc_obligations'\).*\.eq\('firm_id',workspace\.firmId\)/)
  assert.match(prepareRoute,/db\.from\('hmrc_quarterly_submissions'\).*\.eq\('firm_id',workspace\.firmId\)/)
  assert.match(submitRoute,/quarterlySubmissionEligibility/)
  assert.match(submitRoute,/auditError\?\.code==='23505'/)
  assert.match(migration,/create unique index if not exists idx_hmrc_quarterly_submissions_one_active_period/)
  assert.match(migration,/where status in \('sending','submitted'\)/)
})

test('agent ASA OAuth state and callback are stored separately from taxpayer OAuth',()=>{
  const state=readFileSync('lib/oauth-state.ts','utf8')
  const start=readFileSync('app/api/hmrc/oauth/start/route.ts','utf8')
  const callback=readFileSync('app/api/hmrc/callback/route.ts','utf8')
  const agentsPage=readFileSync('app/taxpayers/[id]/agents/page.tsx','utf8')

  assert.match(state,/agentId/)
  assert.match(start,/searchParams\.get\('agentId'\)/)
  assert.match(callback,/agent_hmrc_connections/)
  assert.match(callback,/agentConnected=1/)
  assert.match(agentsPage,/Connect ASA/)
  assert.match(agentsPage,/agentId=\$\{encodeURIComponent\(r\.agent_id\)\}/)
})

test('delegated agent relationship controls are firm scoped and audited',()=>{
  const route=readFileSync('app/api/agents/hmrc-relationship/route.ts','utf8')
  const revoke=readFileSync('app/api/agents/revoke/route.ts','utf8')
  const helper=readFileSync('lib/agent-authorisation.ts','utf8')
  const page=readFileSync('app/taxpayers/[id]/agents/page.tsx','utf8')

  assert.match(route,/currentWorkspace/)
  assert.match(route,/buildFraudHeaders\(req,form,taxpayerId\)/)
  assert.match(route,/db\.from\('taxpayers'\).*\.eq\('firm_id',workspace\.firmId\)/)
  assert.match(route,/db\.from\('mtd_agents'\).*\.eq\('firm_id',workspace\.firmId\)/)
  assert.match(route,/db\.from\('mtd_agent_authorisations'\).*\.eq\('firm_id',workspace\.firmId\)/)
  assert.match(route,/db\.from\('agent_hmrc_connections'\).*\.eq\('firm_id',workspace\.firmId\)/)
  assert.match(route,/mtd_submission_audit/)
  assert.match(route,/hmrc_correlation_id/)
  assert.match(revoke,/\.eq\('firm_id',workspace\.firmId\)/)
  assert.match(helper,/currentWorkspace/)
  assert.match(helper,/\.eq\('firm_id',workspace\.firmId\)/)
  assert.match(page,/FraudContextFields/)
  assert.match(page,/db\.from\('mtd_agent_authorisations'\).*\.eq\('firm_id',workspace\.firmId\)/)
})

test('taxpayer HMRC pages scope read models to the current firm',()=>{
  const pageFiles=[
    'app/taxpayers/[id]/page.tsx',
    'app/taxpayers/[id]/businesses/page.tsx',
    'app/taxpayers/[id]/digital-records/page.tsx',
    'app/taxpayers/[id]/submissions/page.tsx',
    'app/taxpayers/[id]/quarterly/page.tsx',
    'app/taxpayers/[id]/quarterly/readiness/page.tsx',
    'app/taxpayers/[id]/quarterly/review/page.tsx',
    'app/taxpayers/[id]/quarterly/history/page.tsx',
    'app/taxpayers/[id]/end-of-year/adjustments/page.tsx',
    'app/taxpayers/[id]/end-of-year/employment/page.tsx',
    'app/taxpayers/[id]/end-of-year/other-income/page.tsx',
    'app/taxpayers/[id]/end-of-year/reliefs/page.tsx',
    'app/taxpayers/[id]/end-of-year/state-benefits/page.tsx',
    'app/taxpayers/[id]/end-of-year/tax-liability/page.tsx',
    'app/taxpayers/[id]/calculations/confirmation/page.tsx',
  ]
  for(const file of pageFiles){
    const source=readFileSync(file,'utf8')
    assert.match(source,/currentWorkspace/,`${file} must resolve the active workspace`)
    assert.match(source,/firmId|workspace\.firmId/,`${file} must keep the active firm id available`)
    assert.match(source,/eq\('firm_id'/,`${file} must scope Supabase reads with firm_id`)
  }
})

test('firm, session and billing tables explicitly deny browser roles',()=>{
  const migration=readFileSync('supabase/migrations/015_private_firm_and_billing_rls.sql','utf8')
  for(const table of ['accounting_firms','app_active_sessions','app_users','firm_access_audit','firm_subscription_purchases','firm_subscriptions','subscription_bundles']){
    assert.match(migration,new RegExp(`'${table}'`))
  }
  assert.match(migration,/for select to anon, authenticated using \(false\)/)
  assert.match(migration,/for insert to anon, authenticated with check \(false\)/)
  assert.match(migration,/for update to anon, authenticated using \(false\) with check \(false\)/)
  assert.match(migration,/for delete to anon, authenticated using \(false\)/)
  assert.match(migration,/revoke all on public\.\%I from anon, authenticated/)
})

test('HMRC test business creation is sandbox only and restricted to property types',()=>{
  const source=readFileSync('app/api/hmrc/test-support/business/route.ts','utf8')
  assert.match(source,/process\.env\.HMRC_ENVIRONMENT==='production'/)
  assert.match(source,/new Set\(\['uk-property','foreign-property'\]\)/)
  assert.match(source,/individuals\/self-assessment-test-support\/business\/\$\{encodeURIComponent\(taxpayer\.nino\)\}/)
  assert.match(source,/Accept:'application\/vnd\.hmrc\.1\.0\+json'/)
  assert.match(source,/getValidHmrcAccessToken\(taxpayerId\)/)
  assert.match(source,/JSON\.stringify\(\{typeOfBusiness:businessType\}\)/)
})

test('sandbox agent creation uses the shared HMRC production guard',()=>{
  const source=readFileSync('app/api/agents/create-test-agent/route.ts','utf8')
  assert.match(source,/currentWorkspace/)
  assert.match(source,/process\.env\.HMRC_ENVIRONMENT === 'production'/)
  assert.match(source,/create-test-user\/agents/)
})
