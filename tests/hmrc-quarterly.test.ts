import test from 'node:test'
import assert from 'node:assert/strict'
import { buildForeignPropertyCumulativePayload, buildUkPropertyCumulativePayload } from '../lib/hmrc-quarterly.ts'

test('UK property payload follows HMRC v6 detailed cumulative schema',()=>{
  const payload=buildUkPropertyCumulativePayload({
    periodStart:'2026-04-06',periodEnd:'2026-10-05',rents:1200,leasePremiums:20,reversePremiums:10,otherIncome:30,ukTaxDeducted:40,rentARoomReceived:50,
    premisesCosts:250,repairsMaintenance:-25,financialCosts:60,professionalFees:70,costOfServices:80,otherExpenses:90,residentialFinancialCost:100,travelCosts:110,carryForwardResidentialFinanceCost:120,rentARoomRelief:130
  })
  assert.deepEqual(payload,{fromDate:'2026-04-06',toDate:'2026-10-05',ukProperty:{
    income:{premiumsOfLeaseGrant:20,reversePremiums:10,periodAmount:1200,taxDeducted:40,otherIncome:30,rentARoom:{rentsReceived:50}},
    expenses:{premisesRunningCosts:250,repairsAndMaintenance:-25,financialCosts:60,professionalFees:70,costOfServices:80,other:90,residentialFinancialCost:100,travelCosts:110,residentialFinancialCostsCarriedForward:120,rentARoom:{amountClaimed:130}}
  }})
  assert.equal('consolidatedExpenses' in payload.ukProperty.expenses,false)
})

test('UK property payload omits a Rent a Room claim from ordinary cumulative updates',()=>{
  const payload=buildUkPropertyCumulativePayload({periodStart:'2026-04-06',periodEnd:'2026-10-05',rents:1200})
  assert.equal('rentARoom' in payload.ukProperty.expenses,false)
  assert.equal(payload.ukProperty.income.taxDeducted,0)
})

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
