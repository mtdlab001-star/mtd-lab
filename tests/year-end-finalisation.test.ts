import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { YEAR_END_REVIEW_SECTIONS, taxYearHasEnded, yearEndFinalisationStatus } from '../lib/year-end-finalisation.ts'

const completedReviews=YEAR_END_REVIEW_SECTIONS.map(section=>({section,status:'reviewed'}))
const fulfilledObligations=[
  {period_start:'2026-04-06',status:'fulfilled'},
  {period_start:'2026-07-06',status:'fulfilled'},
  {period_start:'2026-10-06',status:'fulfilled'},
  {period_start:'2027-01-06',status:'fulfilled'},
]

test('tax year finalisation starts on 6 April after the selected year',()=>{
  assert.equal(taxYearHasEnded('2026-27',new Date('2027-04-05T23:59:59.999Z')),false)
  assert.equal(taxYearHasEnded('2026-27',new Date('2027-04-06T00:00:00.000Z')),true)
})

test('year end remains blocked before the tax year ends',()=>{
  const result=yearEndFinalisationStatus({
    taxYear:'2026-27',
    businessCount:1,
    obligations:fulfilledObligations,
    reviews:completedReviews,
    now:new Date('2026-08-30T00:00:00Z'),
  })
  assert.equal(result.canFinalise,false)
  assert.deepEqual(result.blockers,['Tax year has not ended'])
})

test('year end requires income sources, obligations and all controlled reviews',()=>{
  const result=yearEndFinalisationStatus({
    taxYear:'2026-27',
    businessCount:0,
    obligations:[],
    reviews:completedReviews.slice(0,-1),
    now:new Date('2027-04-06T00:00:00Z'),
  })
  assert.deepEqual(result.blockers,[
    'No HMRC income sources found',
    'Open or missing quarterly obligations remain',
    'Year end schedules have not all been reviewed',
  ])
})

test('an open quarterly obligation blocks year end',()=>{
  const result=yearEndFinalisationStatus({
    taxYear:'2026-27',
    businessCount:1,
    obligations:[...fulfilledObligations,{period_start:'2027-03-01',status:'open'}],
    reviews:completedReviews,
    now:new Date('2027-04-06T00:00:00Z'),
  })
  assert.equal(result.canFinalise,false)
  assert.equal(result.openCount,1)
  assert.ok(result.blockers.includes('Open or missing quarterly obligations remain'))
})

test('year end becomes ready only when every server condition is satisfied',()=>{
  const result=yearEndFinalisationStatus({
    taxYear:'2026-27',
    businessCount:3,
    obligations:fulfilledObligations,
    reviews:completedReviews,
    now:new Date('2027-04-06T00:00:00Z'),
  })
  assert.equal(result.canFinalise,true)
  assert.deepEqual(result.blockers,[])
  assert.equal(result.completedReviewCount,6)
})

test('intent to finalise and Final Declaration routes enforce the shared server gate',()=>{
  const trigger=readFileSync('app/api/hmrc/calculations/trigger/route.ts','utf8')
  const declaration=readFileSync('app/api/hmrc/calculations/final-declaration/route.ts','utf8')
  const calculationPage=readFileSync('app/taxpayers/[id]/calculations/page.tsx','utf8')

  assert.match(trigger,/calculationType==='intent-to-finalise'/)
  assert.match(trigger,/yearEndFinalisationStatus/)
  assert.match(trigger,/if\(!readiness\.canFinalise\)/)
  assert.ok(trigger.indexOf('if(!readiness.canFinalise)')<trigger.indexOf('let token:string'))
  assert.match(declaration,/yearEndFinalisationStatus/)
  assert.match(declaration,/if\(!readiness\.canFinalise\)/)
  assert.match(calculationPage,/!readiness\.canFinalise/)
})
