import { supabaseAdmin } from '@/lib/supabase-admin'
import { currentWorkspace } from '@/lib/workspace'

export type AgentPermission =
  | 'can_view_records'
  | 'can_manage_records'
  | 'can_view_obligations'
  | 'can_submit_quarterly'
  | 'can_manage_year_end'
  | 'can_submit_final_declaration'

async function firmIdOrThrow(){
  const workspace=await currentWorkspace()
  if(!workspace)throw new Error('Accounting workspace access is not available')
  return workspace.firmId
}

export async function getAgentAuthorisation(taxpayerId:string,agentId:string){
  const firmId=await firmIdOrThrow()
  const db=supabaseAdmin()
  const {data,error}=await db.from('mtd_agent_authorisations').select('*,mtd_agents(*)').eq('firm_id',firmId).eq('taxpayer_id',taxpayerId).eq('agent_id',agentId).maybeSingle()
  if(error) throw error
  const row:any=data
  if(row?.status==='authorised'&&row.expires_at&&new Date(row.expires_at).getTime()<=Date.now()){
    await db.from('mtd_agent_authorisations').update({status:'expired',updated_at:new Date().toISOString()}).eq('firm_id',firmId).eq('id',row.id).eq('status','authorised')
    row.status='expired'
  }
  return row
}

export async function expireAgentAuthorisations(taxpayerId?:string){
  const firmId=await firmIdOrThrow()
  const db=supabaseAdmin();const now=new Date().toISOString();let q=db.from('mtd_agent_authorisations').update({status:'expired',updated_at:now}).eq('firm_id',firmId).eq('status','authorised').lt('expires_at',now)
  if(taxpayerId)q=q.eq('taxpayer_id',taxpayerId)
  const {error}=await q
  if(error)throw error
}

export async function agentCan(taxpayerId:string,agentId:string,permission:AgentPermission){
  const row:any=await getAgentAuthorisation(taxpayerId,agentId)
  if(!row||row.status!=='authorised') return false
  if(row.revoked_at) return false
  if(row.mtd_agents?.status&&row.mtd_agents.status!=='active') return false
  return row[permission]===true
}

export async function resolveConnectedAgentForPermission(taxpayerId:string,permission:AgentPermission,requestedAgentId?:string|null){
  const firmId=await firmIdOrThrow()
  const db=supabaseAdmin()
  await expireAgentAuthorisations(taxpayerId)

  const {data:taxpayer,error:taxpayerError}=await db.from('taxpayers').select('id').eq('id',taxpayerId).eq('firm_id',firmId).maybeSingle()
  if(taxpayerError)throw taxpayerError
  if(!taxpayer)throw new Error('This taxpayer is not available in your accounting workspace')

  const {data:authorisations,error:authorisationError}=await db
    .from('mtd_agent_authorisations')
    .select('agent_id,expires_at,revoked_at,mtd_agents(status)')
    .eq('firm_id',firmId)
    .eq('taxpayer_id',taxpayerId)
    .eq('status','authorised')
    .eq(permission,true)
  if(authorisationError) throw authorisationError

  const active=(authorisations||[]).filter((row:any)=>{
    if(row.revoked_at) return false
    if(row.expires_at&&new Date(row.expires_at).getTime()<=Date.now()) return false
    return !row.mtd_agents?.status||row.mtd_agents.status==='active'
  })

  const ids=active.map((row:any)=>String(row.agent_id)).filter(Boolean)
  if(!ids.length){
    if(requestedAgentId) throw new Error('The selected agent is not currently authorised for this HMRC action.')
    return null
  }

  const {data:connections,error:connectionError}=await db
    .from('agent_hmrc_connections')
    .select('agent_id,access_token,refresh_token')
    .eq('firm_id',firmId)
    .in('agent_id',ids)
  if(connectionError) throw connectionError
  const connected=new Set((connections||[]).filter((row:any)=>row.access_token||row.refresh_token).map((row:any)=>String(row.agent_id)))

  if(requestedAgentId){
    if(!ids.includes(requestedAgentId)) throw new Error('The selected agent is not currently authorised for this HMRC action.')
    if(!connected.has(requestedAgentId)) throw new Error('Connect this agent ASA to HMRC before acting for this taxpayer.')
    return requestedAgentId
  }

  const eligible=ids.filter((id:string)=>connected.has(id))
  return eligible.length===1?eligible[0]:null
}