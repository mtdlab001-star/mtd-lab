import test from 'node:test'
import assert from 'node:assert/strict'
import { buildForeignPropertyCumulativePayload } from '../lib/hmrc-quarterly.ts'

test('foreign property payload uses country code for 2025 to 2026 cumulative submissions',()=>{
  const payload=buildForeignPropertyCumulativePayload({
    periodStart:'2026-04-06',
    periodEnd:'2026-10-05',
    rents:3500,
    leasePremiums:0,
    otherIncome:0,
    propertyExpenses:1540
  },'2025-26')
  assert.equal(payload.fromDate,'2026-04-06')
  assert.equal(payload.toDate,'2026-10-05')
  assert.deepEqual(payload.foreignProperty,[{
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

test('foreign property payload uses property ID for 2026 to 2027 cumulative submissions',()=>{
  const payload=buildForeignPropertyCumulativePayload({
    periodStart:'2026-04-06',
    periodEnd:'2026-10-05',
    propertyId:'8e8b8450-dc1b-4360-8109-7067337b42cb',
    rents:1285,
    leasePremiums:0,
    otherIncome:0,
    propertyExpenses:1012
  },'2026-27')
  assert.deepEqual(payload.foreignProperty,[{
    propertyId:'8e8b8450-dc1b-4360-8109-7067337b42cb',
    income:{
      rentIncome:{rentAmount:1285},
      foreignTaxCreditRelief:false,
      premiumsOfLeaseGrant:0,
      otherPropertyIncome:0
    },
    expenses:{consolidatedExpenses:1012}
  }])
  assert.equal('foreignNonFhlProperty' in payload,false)
})
