import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFraudHeaders } from '../lib/hmrc-fraud.ts'

function form(values:Record<string,string>){
  const data=new FormData()
  for(const [key,value] of Object.entries(values)) data.set(key,value)
  return data
}

test('sandbox fraud headers provide safe fallbacks for sandbox evidence',()=>{
  process.env.HMRC_ENVIRONMENT='sandbox'
  delete process.env.HMRC_VENDOR_PUBLIC_IP
  delete process.env.HMRC_VENDOR_LICENSE_ID_HASH
  const req=new Request('https://mtd-lab-two.vercel.app/api/hmrc/quarterly/submit',{headers:{'x-forwarded-for':'203.0.113.10'}})
  const result=buildFraudHeaders(req,form({
    browserUserAgent:'Mozilla/5.0',
    deviceId:'device-1',
    screens:'width=390&height=844&scaling-factor=3&colour-depth=24',
    timezone:'UTC+01:00',
    windowSize:'width=390&height=844'
  }),'sandbox-29a681df')
  assert.deepEqual(result.missing,[])
  assert.equal(result.headers['Gov-Client-Public-Port'],'443')
  assert.match(result.headers['Gov-Client-Multi-Factor'],/^type=OTHER&timestamp=/)
  assert.equal(result.headers['Gov-Vendor-Public-IP'],'203.0.113.10')
  assert.equal(result.headers['Gov-Vendor-License-IDs'],'mtd-lab=sandbox')
})

test('production fraud headers still require real vendor values',()=>{
  process.env.HMRC_ENVIRONMENT='production'
  delete process.env.HMRC_VENDOR_PUBLIC_IP
  delete process.env.HMRC_VENDOR_LICENSE_ID_HASH
  const req=new Request('https://mtd-lab-two.vercel.app/api/hmrc/quarterly/submit',{headers:{'x-forwarded-for':'203.0.113.10'}})
  const result=buildFraudHeaders(req,form({
    browserUserAgent:'Mozilla/5.0',
    deviceId:'device-1',
    screens:'width=390&height=844&scaling-factor=3&colour-depth=24',
    timezone:'UTC+01:00',
    windowSize:'width=390&height=844',
    clientPublicPort:'443',
    multiFactor:'type=OTHER&timestamp=2026-08-24T15:30:00.000Z'
  }),'sandbox-29a681df')
  assert.ok(result.missing.includes('Gov-Vendor-Forwarded'))
  assert.ok(result.missing.includes('Gov-Vendor-License-IDs'))
  assert.ok(result.missing.includes('Gov-Vendor-Public-IP'))
})
