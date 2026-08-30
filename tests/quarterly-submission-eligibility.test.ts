import test from 'node:test'
import assert from 'node:assert/strict'
import { quarterlySubmissionEligibility } from '../lib/quarterly-submission-eligibility.ts'

const base={
  taxpayerId:'taxpayer-1',
  businessId:'XBIS12345678901',
  periodStart:'2026-04-06',
  periodEnd:'2026-10-05',
  requestedType:'self-employment',
  business:{business_id:'XBIS12345678901',business_type:'self-employment',raw:{}},
  obligations:[{taxpayer_id:'taxpayer-1',business_id:'XBIS12345678901',period_start:'2026-04-06',period_end:'2026-10-05',status:'Open'}],
  submissions:[],
  currentDate:'2026-10-05'
}

test('allows a known business with a matching open obligation',()=>{
  const result=quarterlySubmissionEligibility(base)
  assert.equal(result.ok,true)
  if(result.ok)assert.equal(result.sourceType,'self-employment')
})

test('blocks an already accepted quarterly period',()=>{
  const result=quarterlySubmissionEligibility({...base,submissions:[{taxpayer_id:'taxpayer-1',business_id:'XBIS12345678901',period_start:'2026-04-06',period_end:'2026-10-05',status:'submitted'}]})
  assert.deepEqual(result,{ok:false,error:'This cumulative quarterly period has already been submitted or is currently being sent'})
})

test('blocks a concurrent sending attempt',()=>{
  const result=quarterlySubmissionEligibility({...base,submissions:[{taxpayer_id:'taxpayer-1',business_id:'XBIS12345678901',period_start:'2026-04-06',period_end:'2026-10-05',status:'sending'}]})
  assert.equal(result.ok,false)
})

test('blocks periods without a matching open obligation',()=>{
  const result=quarterlySubmissionEligibility({...base,obligations:[{...base.obligations[0],status:'Fulfilled'}]})
  assert.deepEqual(result,{ok:false,error:'No open eligible HMRC obligation matches this business and period'})
})

test('blocks submission before the cumulative period has ended',()=>{
  const result=quarterlySubmissionEligibility({...base,currentDate:'2026-08-30'})
  assert.deepEqual(result,{ok:false,error:'This quarterly update cannot be submitted before the period ends on 2026-10-05'})
})

test('blocks an income source type that does not match the stored business',()=>{
  const result=quarterlySubmissionEligibility({...base,requestedType:'uk-property'})
  assert.deepEqual(result,{ok:false,error:'The selected income source type does not match the HMRC business'})
})

test('does not treat an unassigned obligation as proof of an arbitrary business',()=>{
  const result=quarterlySubmissionEligibility({...base,business:null,obligations:[{...base.obligations[0],business_id:null}]})
  assert.deepEqual(result,{ok:false,error:'Select a valid HMRC business before submission'})
})
