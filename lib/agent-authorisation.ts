import { supabaseAdmin } from '@/lib/supabase-admin'

export type AgentPermission =
  | 'can_view_records'
  | 'can_manage_records'
  | 'can_view_obligations'
  | 'can_submit_quarterly'
  | 'can_manage_year_end'
  | 'can_submit_final_declaration'

export async function getAgentAuthorisation(taxpayerId:string,agentId:string){
  const {data,error}=await supabaseAdmin()
    .from('mtd_agent_authorisations')
    .select('*,mtd_agents(*)')
    .eq('taxpayer_id',taxpayerId)
    .eq('agent_id',agentId)
    .maybeSingle()
  if(error) throw error
  return data
}

export async function agentCan(taxpayerId:string,agentId:string,permission:AgentPermission){
  const row:any=await getAgentAuthorisation(taxpayerId,agentId)
  if(!row||row.status!=='authorised') return false
  if(row.expires_at&&new Date(row.expires_at).getTime()<=Date.now()) return false
  if(row.revoked_at) return false
  if(row.mtd_agents?.status&&row.mtd_agents.status!=='active') return false
  return row[permission]===true
}
