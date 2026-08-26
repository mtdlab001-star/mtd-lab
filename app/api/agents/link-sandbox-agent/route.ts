import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isSameOriginRequest } from '@/lib/request-security'

export async function POST(req:Request){
  if(!isSameOriginRequest(req)) return new NextResponse('Invalid request origin',{status:403})
  if(process.env.HMRC_ENVIRONMENT==='production') return NextResponse.json({error:'Sandbox agent linking is disabled in production HMRC mode.'},{status:403})
  const body=await req.json().catch(()=>({}))
  const agentId=String(body.agentId||'').trim()
  const arn=String(body.arn||'').trim().toUpperCase().replace(/\s+/g,'')
  if(!agentId||!arn) return NextResponse.json({error:'Agent and HMRC Agent Services Account number are required.'},{status:400})
  if(!/^[A-Z0-9]{6,20}$/.test(arn)) return NextResponse.json({error:'The HMRC Agent Services Account number format is not valid.'},{status:400})
  const db=supabaseAdmin()
  const {data:agent,error:readError}=await db.from('mtd_agents').select('id,agent_name').eq('id',agentId).maybeSingle()
  if(readError) return NextResponse.json({error:readError.message},{status:500})
  if(!agent) return NextResponse.json({error:'Agent not found.'},{status:404})
  const {error}=await db.from('mtd_agents').update({hmrc_arn:arn,updated_at:new Date().toISOString()}).eq('id',agentId)
  if(error) return NextResponse.json({error:error.message},{status:500})
  return NextResponse.json({ok:true,agentId,agentName:agent.agent_name,hmrcArn:arn})
}
