import test from 'node:test'
import assert from 'node:assert/strict'
import { reconcileSandboxObligationBusinessIds } from '../lib/hmrc-obligations.ts'

const propertyBusinesses=[
  {businessId:'XCIS98583237761',typeOfBusiness:'uk-property'},
  {businessId:'X9IS48219595807',typeOfBusiness:'foreign-property'},
]

test('keeps an exact sandbox obligation business ID unchanged',()=>{
  const row={businessId:'XCIS98583237761',status:'open'}
  const result=reconcileSandboxObligationBusinessIds([row],propertyBusinesses,'sandbox')

  assert.equal(result[0],row)
})

test('maps canned sandbox property IDs to the taxpayer property businesses',()=>{
  const result=reconcileSandboxObligationBusinessIds([
    {businessId:'XPIS12345678901',status:'open'},
    {businessId:'XFIS12345678901',status:'open'},
  ],propertyBusinesses,'sandbox')

  assert.deepEqual(result.map(row=>row.businessId),['XCIS98583237761','X9IS48219595807'])
  assert.equal(result[0].sandboxSourceBusinessId,'XPIS12345678901')
  assert.equal(result[1].sandboxSourceBusinessId,'XFIS12345678901')
  assert.equal(result[0].sandboxBusinessIdRemapped,true)
})

test('does not guess when more than one sandbox business has the same type',()=>{
  const row={businessId:'XPIS12345678901',status:'open'}
  const result=reconcileSandboxObligationBusinessIds([row],[
    ...propertyBusinesses,
    {businessId:'XPIS99999999999',typeOfBusiness:'uk-property'},
  ],'sandbox')

  assert.equal(result[0],row)
})

test('never remaps HMRC production obligation IDs',()=>{
  const row={businessId:'XPIS12345678901',status:'open'}
  const result=reconcileSandboxObligationBusinessIds([row],propertyBusinesses,'production')

  assert.equal(result[0],row)
})
