import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('taxpayer sidebar does not show every income source when sourceTypes is omitted',()=>{
  const source=readFileSync(new URL('../app/components/TaxpayerSidebar.tsx',import.meta.url),'utf8')
  assert.match(source,/const visibleSourceTypes = sourceTypes \|\| \[\]/)
  assert.doesNotMatch(source,/sourceTypes\?\.length \? sourceTypes : \['self-employment', 'uk-property', 'foreign-property'\]/)
})
