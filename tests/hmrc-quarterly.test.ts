import test from 'node:test'
import assert from 'node:assert/strict'
import { buildForeignPropertyCumulativePayload } from '../lib/hmrc-quarterly.ts'

test('foreign property payload uses HMRC non FHL country structure',()=>{
  const payload=buildForeignPropertyCumulativePayload({
    periodStart:'2026-04-06',
    periodEnd:'2026-10-05',
    rents:3500,
    leasePremiums:0,
    otherIncome:0,
    propertyExpenses:1540
  })
  assert.equal(payload.fromDate,'2026-04-06')
  assert.equal(payload.toDate,'2026-10-05')
  assert.deepEqual(payload.foreignProperty.foreignNonFhlProperty,[{
    countryCode:'FRA',
    income:{
      rentIncome:{rentAmount:3500},
      foreignTaxCreditRelief:false,
      premiumsOfLeaseGrant:0,
      otherPropertyIncome:0
    },
    expenses:{consolidatedExpenses:1540}
  }])
  assert.equal('foreignNonFhlProperty' in payload,false)
})
