import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('taxpayer sidebar does not show every income source when sourceTypes is omitted',()=>{
  const source=readFileSync(new URL('../app/components/TaxpayerSidebar.tsx',import.meta.url),'utf8')
  assert.match(source,/const visibleSourceTypes = sourceTypes \|\| \[\]/)
  assert.doesNotMatch(source,/sourceTypes\?\.length \? sourceTypes : \['self-employment', 'uk-property', 'foreign-property'\]/)
})

test('obligation fallback sources supplement HMRC business rows when a source is missing',()=>{
  const resolver=readFileSync(new URL('../lib/mtd-income-sources-server.ts',import.meta.url),'utf8')
  assert.doesNotMatch(resolver,/if\(sources\.size===0\)\{/)
  assert.match(resolver,/if\(businessId&&!sources\.has\(businessId\)\)sources\.set\(businessId,\{businessId,businessName:null,sourceType:incomeSourceTypeFromBusinessId\(businessId\),fallback:true\}\)/)
})

test('taxpayer overview filters grouped obligations to visible income sources',()=>{
  const page=readFileSync(new URL('../app/taxpayers/[id]/page.tsx',import.meta.url),'utf8')
  assert.match(page,/const incomeSources = mergeMtdIncomeSources\(businesses, obligations\)/)
  assert.match(page,/visibleBusinessIds\.has\(String\(o\.business_id \|\| ''\)\.trim\(\)\)/)
  assert.match(page,/const sourceByBusinessId = new Map\(incomeSources\.map\(source => \[source\.businessId, source\]\)\)/)
})

test('taxpayer overview uses the quarterly obligations table arrangement',()=>{
  const page=readFileSync(new URL('../app/taxpayers/[id]/page.tsx',import.meta.url),'utf8')
  assert.match(page,/Quarterly Obligations/)
  assert.match(page,/Submission Date & Time/)
  assert.match(page,/Retrieve Obligations/)
  assert.match(page,/Annual Submission/)
})
