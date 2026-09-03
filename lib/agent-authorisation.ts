import { supabaseAdmin } from '@/lib/supabase-admin'
import { currentWorkspace } from '@/lib/workspace'

export type AgentPermission =
  | 'can_view_records'
  | 'can_manage_records'
  | 'can_view_obligations'
  | 'can_submit_quarterly'
  | 'can_manage_year_end'
  | 'can_submit_final_declaration'

export async function getAgentAuthorisation(taxpayerId:string,agentId:string){
  const db=supabaseAdmin()
  const workspace=await currentWorkspace()
  if(!workspace) return null
  const {data,error}=await db.from('mtd_agent_authorisations').select('*').eq('firm_id',workspace.firmId).eq('taxpayer_id',taxpayerId).eq('agent_id',agentId).maybeSingle()
  if(error) throw error
  const row:any=data
  if(row?.agent_id){const {data:agent,error:agentError}=await db.from('mtd_agents').select('*').eq('firm_id',workspace.firmId).eq('id',row.agent_id).maybeSingle();if(agentError)throw agentError;row.mtd_agents=agent}
  if(row?.status==='authorised'&&row.expires_at&&new Date(row.expires_at).getTime()<=Date.now()){
    await db.from('mtd_agent_authorisations').update({status:'expired',updated_at:new Date().toISOString()}).eq('id',row.id).eq('firm_id',workspace.firmId).eq('status','authorised')
    row.status='expired'
  }
  return row
}

export async function expireAgentAuthorisations(taxpayerId?:string){
  const workspace=await currentWorkspace()
  if(!workspace)return
  const db=supabaseAdmin();const now=new Date().toISOString();let q=db.from('mtd_agent_authorisations').update({status:'expired',updated_at:now}).eq('status','authorised').lt('expires_at',now)
  q=q.eq('firm_id',workspace.firmId)
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
  const db=supabaseAdmin()
  const workspace=await currentWorkspace()
  if(!workspace)throw new Error('Accounting workspace access is not available')
  await expireAgentAuthorisations(taxpayerId)

  const {data:authorisations,error:authorisationError}=await db
    .from('mtd_agent_authorisations')
    .select('agent_id,expires_at,revoked_at')
    .eq('firm_id',workspace.firmId)
    .eq('taxpayer_id',taxpayerId)
    .eq('status','authorised')
    .eq(permission,true)
  if(authorisationError) throw authorisationError

  const agentIds=Array.from(new Set((authorisations||[]).map((row:any)=>String(row.agent_id||'')).filter(Boolean)))
  const {data:agents,error:agentsError}=agentIds.length?await db.from('mtd_agents').select('id,status').eq('firm_id',workspace.firmId).in('id',agentIds):{data:[],error:null} as any
  if(agentsError) throw agentsError
  const agentStatusById=new Map((agents||[]).map((agent:any)=>[String(agent.id),agent.status]))

  const active=(authorisations||[]).filter((row:any)=>{
    if(row.revoked_at) return false
    if(row.expires_at&&new Date(row.expires_at).getTime()<=Date.now()) return false
    return agentStatusById.get(String(row.agent_id))==='active'
  })

  const ids=active.map((row:any)=>String(row.agent_id)).filter(Boolean)
  if(!ids.length){
    if(requestedAgentId) throw new Error('The selected agent is not currently authorised for this HMRC action.')
    return null
  }

  const {data:connections,error:connectionError}=await db
    .from('agent_hmrc_connections')
    .select('agent_id,access_token,refresh_token')
    .eq('firm_id',workspace.firmId)
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
