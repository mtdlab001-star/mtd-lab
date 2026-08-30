import test from 'node:test'
import assert from 'node:assert/strict'
import { quarterlyEvidenceDetail, quarterlyFinancials } from '../lib/submission-evidence.ts'

const acceptedQuarterly={
 id:'63f8f505-8f9d-4bc4-85e5-da033929fda9',
 business_id:'XBIS12345678901',
 period_start:'2026-04-06',
 period_end:'2026-10-05',
 hmrc_http_status:204,
 request_payload:{
  incomeSourceType:'self-employment',
  payload:{
   periodIncome:{turnover:1100,other:0,taxTakenOffTradingIncome:0},
   periodExpenses:{otherExpenses:600,wagesAndStaffCosts:0},
  },
 },
}

test('calculates cumulative quarterly income, expenses and net profit',()=>{
 assert.deepEqual(quarterlyFinancials(acceptedQuarterly),{income:1100,expenses:600,net:500})
})

test('download evidence includes financial totals and the stored submission ID',()=>{
 const detail=quarterlyEvidenceDetail(acceptedQuarterly,'Self Assessment')
 assert.match(detail,/Income £1,100\.00/)
 assert.match(detail,/Expenses £600\.00/)
 assert.match(detail,/Net £500\.00/)
 assert.match(detail,/Submission ID 63f8f505-8f9d-4bc4-85e5-da033929fda9/)
 assert.match(detail,/HMRC HTTP 204/)
})

test('calculates property totals from the property payload',()=>{
 const property={request_payload:{payload:{ukProperty:{income:{premiumsOfLeaseGrant:400,rentIncome:900},expenses:{premisesRunningCosts:250,other:50}}}}}
 assert.deepEqual(quarterlyFinancials(property),{income:1300,expenses:300,net:1000})
})

test('calculates UK property totals from the accepted cumulative payload',()=>{
 const property={request_payload:{incomeSourceType:'uk-property',payload:{ukProperty:{income:{premiumsOfLeaseGrant:0,reversePremiums:0,periodAmount:1000,taxDeducted:0,otherIncome:100,rentARoom:{rentsReceived:0}},expenses:{premisesRunningCosts:100,repairsAndMaintenance:0,financialCosts:0,professionalFees:150,costOfServices:0,other:350,residentialFinancialCost:0,travelCosts:0,residentialFinancialCostsCarriedForward:0,rentARoom:{amountClaimed:0}}}}}}
 assert.deepEqual(quarterlyFinancials(property),{income:1100,expenses:600,net:500})
})

test('calculates foreign property totals from its array and nested rent amount',()=>{
 const property={request_payload:{incomeSourceType:'foreign-property',payload:{foreignProperty:[{propertyId:'X9IS48219595807',income:{rentIncome:{rentAmount:1000},foreignTaxCreditRelief:false,premiumsOfLeaseGrant:0,otherPropertyIncome:100},expenses:{consolidatedExpenses:600}}]}}}
 assert.deepEqual(quarterlyFinancials(property),{income:1100,expenses:600,net:500})
})
