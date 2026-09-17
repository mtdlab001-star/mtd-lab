import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import { annualCompatibilityPatch, annualEndpoint, assertSandboxFeature, compatibilityAmount, mergeAnnualCompatibility, validAnnualTaxYear, winterFuelPaymentCharge } from '../lib/hmrc-compatibility.ts'
import { HMRC_API_VERSIONS, hmrcApiVersionSnapshot, hmrcOtherIncomeAcceptHeader } from '../lib/hmrc-api-versions.ts'

test('annual fields require a consecutive supported tax year and correct source', () => {
  assert.equal(validAnnualTaxYear('2026-27'), true)
  for (const year of ['2025-26', '2026-99', '2026-2027', 'garbage']) assert.equal(validAnnualTaxYear(year), false)
  assert.throws(() => annualCompatibilityPatch('foreign-property', '2026-27', '', '20'))
  assert.throws(() => annualCompatibilityPatch('uk-property', '2026-27', '10', '20'))
  assert.throws(() => annualCompatibilityPatch('self-employment', '2026-27', '', ''))
})
test('amounts preserve zero and reject negative, malformed, excessive or overprecise values', () => {
  assert.equal(compatibilityAmount('', 'Amount'), undefined)
  assert.equal(compatibilityAmount('0', 'Amount'), 0)
  assert.equal(compatibilityAmount('99999999999.99', 'Amount'), 99999999999.99)
  for (const value of ['-1', 'NaN', 'Infinity', '1e3', '12.345', '100000000000', '1,000']) assert.throws(() => compatibilityAmount(value, 'Amount'))
})
test('annual request nesting follows HMRC schemas', () => {
  assert.deepEqual(annualCompatibilityPatch('self-employment', '2026-27', '10', '20'), { adjustments: { adjustmentToProfitsForClass4: 10 }, allowances: { firstYearAllowanceOnPlantAndMachinery: 20 } })
  assert.deepEqual(annualCompatibilityPatch('uk-property', '2026-27', '', '20'), { ukProperty: { allowances: { firstYearAllowanceOnPlantAndMachinery: 20 } } })
  assert.equal(annualEndpoint('uk-property', 'AB123456C', 'XPIS12345678901', '2026-27'), '/individuals/business/property/uk/AB123456C/XPIS12345678901/annual/2026-27')
  assert.match(annualEndpoint('self-employment', 'AB123456C', 'XBIS12345678901', '2026-27'), /business\/self-employment\//)
})
test('annual PUT preserves existing allowances, adjustments and nonfinancial data', () => {
  const existing = { adjustments: { accountingAdjustment: 50 }, allowances: { annualInvestmentAllowance: 100 }, nonFinancials: { class4NicsExemptionReason: 'non-resident' } }
  const merged = mergeAnnualCompatibility(existing, annualCompatibilityPatch('self-employment', '2026-27', '0', '20'), 'self-employment')
  assert.deepEqual(merged, { adjustments: { accountingAdjustment: 50, adjustmentToProfitsForClass4: 0 }, allowances: { annualInvestmentAllowance: 100, firstYearAllowanceOnPlantAndMachinery: 20 }, nonFinancials: existing.nonFinancials })
  assert.deepEqual(existing.allowances, { annualInvestmentAllowance: 100 })
  const uk = { ukProperty: { adjustments: { nonResidentLandlord: true }, allowances: { otherCapitalAllowance: 99 } } }
  assert.deepEqual(mergeAnnualCompatibility(uk, annualCompatibilityPatch('uk-property', '2026-27', '', '20'), 'uk-property').ukProperty, { adjustments: { nonResidentLandlord: true }, allowances: { otherCapitalAllowance: 99, firstYearAllowanceOnPlantAndMachinery: 20 } })
})
test('incompatible trading or property income allowances block merged annual PUT', () => {
  assert.throws(() => mergeAnnualCompatibility({ allowances: { tradingIncomeAllowance: 1000 } }, annualCompatibilityPatch('self-employment', '2026-27', '', '20'), 'self-employment'))
  assert.throws(() => mergeAnnualCompatibility({ ukProperty: { allowances: { propertyIncomeAllowance: 0 } } }, annualCompatibilityPatch('uk-property', '2026-27', '', '20'), 'uk-property'))
  assert.throws(() => mergeAnnualCompatibility([], {}, 'self-employment'))
})
test('sandbox feature guard blocks production including an explicit zero amount', () => {
  assert.throws(() => assertSandboxFeature('Allowance', true, 'production'))
  assert.doesNotThrow(() => assertSandboxFeature('Allowance', false, 'production'))
  assert.doesNotThrow(() => assertSandboxFeature('Allowance', true, 'sandbox'))
})
test('malformed annual sections fail closed rather than constructing a destructive replacement', () => {
  const patch = annualCompatibilityPatch('self-employment', '2026-27', '10', '')
  for (const existing of [{ allowances: [] }, { adjustments: 'invalid' }, { allowances: null }]) assert.throws(() => mergeAnnualCompatibility(existing, patch, 'self-employment'))
  assert.throws(() => mergeAnnualCompatibility({ ukProperty: [] }, annualCompatibilityPatch('uk-property', '2026-27', '', '20'), 'uk-property'))
})
test('Winter Fuel Payment charge uses the exact HMRC path and distinguishes missing from zero', () => {
  assert.equal(winterFuelPaymentCharge({}), null)
  assert.equal(winterFuelPaymentCharge({ previousCalculation: { winterFuelPaymentCharge: 99 } }), null)
  assert.equal(winterFuelPaymentCharge({ calculation: { taxCalculation: { incomeTax: { winterFuelPaymentCharge: 0 } } } }), 0)
  assert.equal(winterFuelPaymentCharge({ calculation: { taxCalculation: { incomeTax: { winterFuelPaymentCharge: 150 } } } }), 150)
})
test('registry includes all current integration families and keeps Calculations v8 selected', () => {
  assert.equal(HMRC_API_VERSIONS.individualCalculations, '8.0')
  assert.equal(HMRC_API_VERSIONS.reliefs, '3.0')
  assert.equal(HMRC_API_VERSIONS.bsas, '7.0')
  assert.equal(HMRC_API_VERSIONS.testSupport, '1.0')
  assert.equal(hmrcApiVersionSnapshot().length, 16)
})
test('Other Income v3 cannot be enabled in production by a sandbox flag', () => {
  const environment = process.env.HMRC_ENVIRONMENT
  const flag = process.env.HMRC_OTHER_INCOME_V3_ENABLED
  try {
    process.env.HMRC_OTHER_INCOME_V3_ENABLED = 'true'
    process.env.HMRC_ENVIRONMENT = 'production'
    assert.throws(() => hmrcOtherIncomeAcceptHeader('2026-27'), /sandbox only/)
    assert.equal(hmrcOtherIncomeAcceptHeader('2025-26'), 'application/vnd.hmrc.2.0+json')
    process.env.HMRC_ENVIRONMENT = 'sandbox'
    assert.equal(hmrcOtherIncomeAcceptHeader('2026-27'), 'application/vnd.hmrc.3.0+json')
    process.env.HMRC_OTHER_INCOME_V3_ENABLED = 'false'
    assert.throws(() => hmrcOtherIncomeAcceptHeader('2026-27'), /not enabled/)
  } finally {
    if (environment === undefined) delete process.env.HMRC_ENVIRONMENT; else process.env.HMRC_ENVIRONMENT = environment
    if (flag === undefined) delete process.env.HMRC_OTHER_INCOME_V3_ENABLED; else process.env.HMRC_OTHER_INCOME_V3_ENABLED = flag
  }
})

const require = createRequire(import.meta.url)
const ts = require('typescript')
const routeCode = ts.transpileModule(readFileSync('app/api/hmrc/annual/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
async function annualRequest(options: { action?: string; environment?: string; ended?: boolean; authorised?: boolean; taxpayer?: boolean; sourceType?: string; allowance?: boolean; getStatus?: number; getPayload?: any; putStatus?: number; expired?: boolean; confirmed?: boolean } = {}) {
  const calls: any[] = []
  const inserts: any[] = []
  const filters: any[] = []
  const patch = annualCompatibilityPatch('self-employment', '2026-27', '10', options.allowance ? '20' : '')
  const db = { from(table: string) {
    const query: any = { select() { return query }, eq(key: string, value: any) { filters.push([table, key, value]); return query }, insert(value: any) { inserts.push(value); return query },
      async maybeSingle() { return { data: table === 'taxpayers' ? options.taxpayer === false ? null : { nino: 'AB123456C' } : { tax_year: '2026-27', business_id: 'XBIS12345678901', acting_agent_id: 'agent', request_payload: patch, created_at: new Date(Date.now() - (options.expired ? 3600000 : 0)).toISOString() } } },
      async single() { return { data: { id: 'draft' } } }, then(resolve: any) { return Promise.resolve({ error: null }).then(resolve) } }
    return query
  } }
  const modules: Record<string, any> = {
    'next/server': { NextResponse: { redirect: (url: URL) => url, } },
    '@/lib/workspace': { currentWorkspace: async () => ({ firmId: 'firm' }) },
    '@/lib/supabase-admin': { supabaseAdmin: () => db },
    '@/lib/request-security': { isSameOriginRequest: () => true },
    '@/lib/mtd-income-sources-server': { listMtdIncomeSources: async () => [{ businessId: 'XBIS12345678901', sourceType: options.sourceType || 'self-employment' }] },
    '@/lib/agent-authorisation': { agentCan: async () => options.authorised !== false },
    '@/lib/hmrc-connection': { getHmrcAccessTokenForActingCapacity: async () => 'test' },
    '@/lib/hmrc-fraud': { buildFraudHeaders: () => ({ missing: [], headers: {} }) },
    '@/lib/hmrc': { hmrcApiBase: 'https://test-api.service.hmrc.gov.uk' },
    '@/lib/hmrc-api-versions': { hmrcAcceptHeader: () => 'application/vnd.hmrc.5.0+json' },
    '@/lib/year-end-finalisation': { taxYearHasEnded: () => options.ended !== false },
    '@/lib/hmrc-compatibility': { annualCompatibilityPatch, annualEndpoint, mergeAnnualCompatibility, assertSandboxFeature: (feature: string, supplied: boolean) => assertSandboxFeature(feature, supplied, options.environment || 'sandbox') },
  }
  const exports: any = {}
  vm.runInNewContext(routeCode, { exports, require: (id: string) => { if (!modules[id]) throw new Error(`Unexpected dependency ${id}`); return modules[id] }, URL, Date, process: { env: { HMRC_ENVIRONMENT: options.environment || 'sandbox', HMRC_ALLOW_PRODUCTION_SUBMISSIONS: 'false' } },
    fetch: async (url: string, init: any) => { calls.push({ url, ...init }); return init.method === 'PUT' ? new Response(null, { status: options.putStatus || 204 }) : new Response(JSON.stringify(options.getPayload || { allowances: { annualInvestmentAllowance: 100 } }), { status: options.getStatus || 200 }) }, console })
  const form = new FormData()
  for (const [key, value] of Object.entries({ taxpayerId: 'client', taxYear: '2026-27', businessId: 'XBIS12345678901', actingAgentId: 'agent', action: options.action || 'submit', draftId: 'draft', adjustmentToProfitsForClass4: '10', annualConfirmed: options.confirmed === false ? '' : 'yes' })) form.set(key, value)
  const url = await exports.POST(new Request('https://mtd.example/api/hmrc/annual', { method: 'POST', body: form }))
  return { url, calls, inserts, filters }
}
test('annual preparation persists a workspace scoped draft without an HMRC request', async () => {
  const result = await annualRequest({ action: 'prepare', ended: false })
  assert.equal(result.calls.length, 0)
  assert.equal(result.inserts[0].status, 'prepared')
  assert.equal(result.inserts[0].firm_id, 'firm')
  assert.equal(result.url.searchParams.get('draftId'), 'draft')
})
test('annual submission enforces year end, production lock, permissions, expiry and confirmation before calling HMRC', async () => {
  for (const options of [{ ended: false }, { environment: 'production' }, { authorised: false }, { expired: true }, { confirmed: false }, { taxpayer: false }, { sourceType: 'foreign-property' }]) {
    const result = await annualRequest(options)
    assert.equal(result.calls.length, 0, JSON.stringify(options))
    assert.ok(result.url.searchParams.get('error'))
  }
})
test('accepted annual sandbox PUT preserves existing values and records actual 204 acceptance', async () => {
  const result = await annualRequest({ allowance: true })
  assert.equal(result.calls.length, 2)
  assert.deepEqual(JSON.parse(result.calls[1].body), { adjustments: { adjustmentToProfitsForClass4: 10 }, allowances: { annualInvestmentAllowance: 100, firstYearAllowanceOnPlantAndMachinery: 20 } })
  assert.equal(result.inserts[0].status, 'accepted')
  assert.equal(result.inserts[0].hmrc_status, 204)
  assert.equal(result.url.searchParams.get('accepted'), '1')
  assert.ok(result.filters.some(([table, key, value]) => table === 'mtd_submission_audit' && key === 'firm_id' && value === 'firm'))
})
test('failed annual retrieval never proceeds to PUT', async () => {
  const result = await annualRequest({ getStatus: 403, getPayload: { code: 'CLIENT_OR_AGENT_NOT_AUTHORISED' } })
  assert.equal(result.calls.length, 1)
  assert.ok(result.url.searchParams.get('error'))
})
test('only the precise annual resource not found response permits creation', async () => {
  const missing = await annualRequest({ getStatus: 404, getPayload: { code: 'MATCHING_RESOURCE_NOT_FOUND' } })
  assert.equal(missing.calls.length, 2)
  assert.equal(missing.url.searchParams.get('accepted'), '1')
  const other = await annualRequest({ getStatus: 404, getPayload: { code: 'NOT_FOUND' } })
  assert.equal(other.calls.length, 1)
  assert.ok(other.url.searchParams.get('error'))
})
test('annual submission refuses incompatible existing income allowances', async () => {
  const result = await annualRequest({ allowance: true, getPayload: { allowances: { tradingIncomeAllowance: 1000 } } })
  assert.equal(result.calls.length, 1)
  assert.match(result.url.searchParams.get('error'), /cannot be combined/)
})
test('unexpected annual success status is not labelled accepted', async () => {
  const result = await annualRequest({ putStatus: 200 })
  assert.equal(result.inserts[0].status, 'rejected')
  assert.equal(result.url.searchParams.get('accepted'), null)
})
