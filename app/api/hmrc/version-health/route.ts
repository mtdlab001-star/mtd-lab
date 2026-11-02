import { NextResponse } from 'next/server'
import { hmrcApiVersionSnapshot } from '@/lib/hmrc-api-versions'
import { currentWorkspace } from '@/lib/workspace'

export async function GET(){
  const workspace=await currentWorkspace()
  if(!workspace)return new NextResponse('Accounting workspace access is not available',{status:403})
  return NextResponse.json({
    checkedAt:new Date().toISOString(),
    environment:process.env.HMRC_ENVIRONMENT||'sandbox',
    automaticProductionUpgrade:false,
    verification:'Configured version registry, not a live HMRC endpoint acceptance test',
    compatibilityBaseline:'2026-11-02',
    policyBaseline:'HMRC guidance updated 2026-10-16 and API catalogue checked 2026-11-02',
    sandboxOnlyFeatures:['firstYearAllowanceOnPlantAndMachinery','taxRefundedOrSetOff','Other Income v3'],
    versions:hmrcApiVersionSnapshot(),
  },{
    headers:{'Cache-Control':'no-store'}
  })
}
