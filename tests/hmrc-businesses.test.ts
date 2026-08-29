import test from 'node:test'
import assert from 'node:assert/strict'
import { hmrcBusinessType, mergeBusinessPayloads } from '../lib/hmrc-businesses.ts'

test('combines stateful sandbox businesses with the default source and removes duplicates',()=>{
  const stateful={listOfBusinesses:[
    {businessId:'XPIS10000000001',typeOfBusiness:'uk-property'},
    {businessId:'XFIS10000000002',typeOfBusiness:'foreign-property'},
  ]}
  const fallback={listOfBusinesses:[
    {businessId:'XBIS12345678901',typeOfBusiness:'self-employment'},
    {businessId:'XPIS10000000001',typeOfBusiness:'uk-property',tradingName:'duplicate'},
  ]}

  const businesses=mergeBusinessPayloads([stateful,fallback])

  assert.deepEqual(businesses.map(row=>row.businessId),[
    'XPIS10000000001',
    'XFIS10000000002',
    'XBIS12345678901',
  ])
  assert.equal(businesses[0].tradingName,undefined)
})

test('reads the Business Details v2 typeOfBusiness field',()=>{
  assert.equal(hmrcBusinessType({typeOfBusiness:'uk-property'}),'uk-property')
  assert.equal(hmrcBusinessType({typeOfBusiness:'foreign-property'}),'foreign-property')
})
