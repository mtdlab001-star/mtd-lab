import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { currentWorkspace } from '@/lib/workspace'
import { isSameOriginRequest } from '@/lib/request-security'

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

export async function POST(req:Request){
  if(!isSameOriginRequest(req))return NextResponse.json({error:'Invalid request origin'},{status:403})
  const workspace=await currentWorkspace()
  if(!workspace)return NextResponse.json({error:'Accounting workspace access is not available'},{status:403})

  let input:any
  try{input=await req.json()}catch{return NextResponse.json({error:'Invalid quarterly draft request'},{status:400})}
  const taxpayerId=String(input?.taxpayerId||'')
  const businessId=String(input?.businessId||'')
  const incomeSourceType=String(input?.incomeSourceType||'')
  const periodEnd=String(input?.periodEnd||'')
  const actingAgentId=String(input?.actingAgentId||'')
  if(!taxpayerId||!businessId||!periodEnd||!allowedIncomeSourceTypes.has(incomeSourceType))return NextResponse.json({error:'Invalid quarterly draft request'},{status:400})

  const db=supabaseAdmin()
  const [{data:taxpayer,error:taxpayerError},{data:draft,error:draftError}]=await Promise.all([
    db.from('taxpayers').select('id').eq('id',taxpayerId).eq('firm_id',workspace.firmId).maybeSingle(),
    db.from('hmrc_quarterly_drafts').select('figures').eq('firm_id',workspace.firmId).eq('taxpayer_id',taxpayerId).eq('business_id',businessId).eq('income_source_type',incomeSourceType).eq('period_end',periodEnd).maybeSingle()
  ])
  if(taxpayerError||draftError)return NextResponse.json({error:'Quarterly draft update is temporarily unavailable'},{status:500})
  if(!taxpayer||!draft)return NextResponse.json({error:'Quarterly draft is not available in this accounting workspace'},{status:404})

  if(actingAgentId){
    const now=new Date().toISOString()
    const [{data:authorisation,error:authorisationError},{data:agent,error:agentError},{data:connection,error:connectionError}]=await Promise.all([
      db.from('mtd_agent_authorisations').select('agent_id').eq('firm_id',workspace.firmId).eq('taxpayer_id',taxpayerId).eq('agent_id',actingAgentId).eq('status','authorised').eq('can_submit_quarterly',true).or(`expires_at.is.null,expires_at.gt.${now}`).maybeSingle(),
      db.from('mtd_agents').select('id').eq('firm_id',workspace.firmId).eq('id',actingAgentId).eq('status','active').maybeSingle(),
      db.from('agent_hmrc_connections').select('agent_id,access_token,refresh_token').eq('firm_id',workspace.firmId).eq('agent_id',actingAgentId).maybeSingle()
    ])
    if(authorisationError||agentError||connectionError)return NextResponse.json({error:'Agent acting capacity validation is temporarily unavailable'},{status:500})
    if(!authorisation||!agent||!connection||( !connection.access_token&&!connection.refresh_token))return NextResponse.json({error:'The selected agent is not authorised and connected for quarterly filing'},{status:403})
  }

  const figures={...(draft.figures&&typeof draft.figures==='object'?draft.figures:{}),actingAgentId}
  const {error:updateError}=await db.from('hmrc_quarterly_drafts').update({figures,updated_at:new Date().toISOString()}).eq('firm_id',workspace.firmId).eq('taxpayer_id',taxpayerId).eq('business_id',businessId).eq('income_source_type',incomeSourceType).eq('period_end',periodEnd)
  if(updateError)return NextResponse.json({error:'Quarterly draft update is temporarily unavailable'},{status:500})
  return NextResponse.json({saved:true},{headers:{'Cache-Control':'no-store'}})
}
