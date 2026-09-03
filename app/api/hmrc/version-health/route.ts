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
    versions:hmrcApiVersionSnapshot(),
  },{
    headers:{'Cache-Control':'no-store'}
  })
}
