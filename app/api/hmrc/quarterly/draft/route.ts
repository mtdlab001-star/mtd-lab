import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { currentWorkspace } from '@/lib/workspace'

const allowedIncomeSourceTypes=new Set(['self-employment','uk-property','foreign-property'])

export async function GET(req:Request){
  const workspace=await currentWorkspace()
  if(!workspace)return NextResponse.json({error:'Accounting workspace access is not available'},{status:403})

  const url=new URL(req.url)
  const taxpayerId=String(url.searchParams.get('taxpayerId')||'')
  const businessId=String(url.searchParams.get('businessId')||'')
  const incomeSourceType=String(url.searchParams.get('incomeSourceType')||'')
  const periodEnd=String(url.searchParams.get('periodEnd')||'')

  if(!taxpayerId||!businessId||!periodEnd||!allowedIncomeSourceTypes.has(incomeSourceType)){
    return NextResponse.json({error:'Invalid quarterly draft request'},{status:400})
  }

  const db=supabaseAdmin()
  const {data:taxpayer,error:taxpayerError}=await db.from('taxpayers').select('id').eq('id',taxpayerId).eq('firm_id',workspace.firmId).maybeSingle()
  if(taxpayerError)return NextResponse.json({error:'Quarterly draft lookup is temporarily unavailable'},{status:500})
  if(!taxpayer)return NextResponse.json({error:'Taxpayer is not available in this accounting workspace'},{status:404})

  const {data,error}=await db.from('hmrc_quarterly_drafts')
    .select('figures,updated_at')
    .eq('firm_id',workspace.firmId)
    .eq('taxpayer_id',taxpayerId)
    .eq('business_id',businessId)
    .eq('income_source_type',incomeSourceType)
    .eq('period_end',periodEnd)
    .maybeSingle()

  if(error)return NextResponse.json({error:'Quarterly draft lookup is temporarily unavailable'},{status:500})
  return NextResponse.json(data||{figures:null,updated_at:null},{headers:{'Cache-Control':'no-store'}})
}
