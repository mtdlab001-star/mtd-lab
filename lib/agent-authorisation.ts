import { supabaseAdmin } from '@/lib/supabase-admin'

export type AgentPermission =
  | 'can_view_records'
  | 'can_manage_records'
  | 'can_view_obligations'
  | 'can_submit_quarterly'
  | 'can_manage_year_end'
  | 'can_submit_final_declaration'

export async function getAgentAuthorisation(taxpayerId:string,agentId:string){
  const db=supabaseAdmin()
  const {data,error}=await db.from('mtd_agent_authorisations').select('*,mtd_agents(*)').eq('taxpayer_id',taxpayerId).eq('agent_id',agentId).maybeSingle()
  if(error) throw error
  const row:any=data
  if(row?.status==='authorised'&&row.expires_at&&new Date(row.expires_at).getTime()<=Date.now()){
    await db.from('mtd_agent_authorisations').update({status:'expired',updated_at:new Date().toISOString()}).eq('id',row.id).eq('status','authorised')
    row.status='expired'
  }
  return row
}

export async function expireAgentAuthorisations(taxpayerId?:string){
  const db=supabaseAdmin();const now=new Date().toISOString();let q=db.from('mtd_agent_authorisations').update({status:'expired',updated_at:now}).eq('status','authorised').lt('expires_at',now)
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
