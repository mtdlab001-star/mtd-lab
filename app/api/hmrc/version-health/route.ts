import { NextResponse } from 'next/server'
import { hmrcApiVersionSnapshot } from '@/lib/hmrc-api-versions'

export async function GET(){
  return NextResponse.json({
    checkedAt:new Date().toISOString(),
    environment:process.env.HMRC_ENVIRONMENT||'sandbox',
    automaticProductionUpgrade:false,
    versions:hmrcApiVersionSnapshot(),
  },{
    headers:{'Cache-Control':'no-store'}
  })
}
