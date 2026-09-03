import { refreshAccessToken } from '@/lib/hmrc'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { currentWorkspace } from '@/lib/workspace'

async function taxpayerWorkspace(){
  const workspace=await currentWorkspace()
  if(!workspace)throw new Error('Accounting workspace access is not available')
  return workspace
}

async function assertTaxpayerAccess(taxpayerId:string){
  const workspace=await taxpayerWorkspace()
  const {data}=await supabaseAdmin().from('taxpayers').select('id').eq('id',taxpayerId).eq('firm_id',workspace.firmId).maybeSingle()
  if(!data)throw new Error('This taxpayer is not available in your accounting workspace')
  return workspace
}

async function assertAgentAccess(agentId:string){
  const workspace=await taxpayerWorkspace()
  const {data}=await supabaseAdmin().from('mtd_agents').select('id').eq('id',agentId).eq('firm_id',workspace.firmId).maybeSingle()
  if(!data)throw new Error('This agent is not available in your accounting workspace')
  return workspace
}

async function refreshStoredToken(table:string,column:string,id:string,firmId:string,conn:any){
  if(!conn.refresh_token) throw new Error('HMRC session expired. Reconnect to HMRC.')
  const db=supabaseAdmin()
  const token=await refreshAccessToken(conn.refresh_token)
  const nextExpiresAt=new Date(Date.now()+token.expires_in*1000).toISOString()
  const {error:updateError}=await db.from(table).update({
    access_token:token.access_token,
    refresh_token:token.refresh_token||conn.refresh_token,
    token_expires_at:nextExpiresAt,
    scope:token.scope||conn.scope||null,
    updated_at:new Date().toISOString()
  }).eq('firm_id',firmId).eq(column,id)
  if(updateError) throw new Error(`Could not save refreshed HMRC token: ${updateError.message}`)
  return token.access_token
}

export async function getValidHmrcAccessToken(taxpayerId:string){
  const workspace=await assertTaxpayerAccess(taxpayerId)
  const db=supabaseAdmin()
  const {data:conn,error}=await db.from('hmrc_connections').select('*').eq('firm_id',workspace.firmId).eq('taxpayer_id',taxpayerId).maybeSingle()
  if(error||!conn?.access_token) throw new Error('Connect this taxpayer to HMRC first')

  const expiresAt=conn.token_expires_at?new Date(conn.token_expires_at).getTime():0
  const needsRefresh=Boolean(expiresAt && expiresAt <= Date.now()+60_000)
  if(!needsRefresh) return conn.access_token as string
  if(!conn.refresh_token) throw new Error('HMRC session expired. Reconnect this taxpayer to HMRC.')

  return refreshStoredToken('hmrc_connections','taxpayer_id',taxpayerId,workspace.firmId,conn)
}

export async function getValidAgentHmrcAccessToken(agentId:string){
  const workspace=await assertAgentAccess(agentId)
  const db=supabaseAdmin()
  const {data:conn,error}=await db.from('agent_hmrc_connections').select('*').eq('firm_id',workspace.firmId).eq('agent_id',agentId).maybeSingle()
  if(error||!conn?.access_token) throw new Error('Connect this agent ASA to HMRC before filing for authorised clients.')

  const expiresAt=conn.token_expires_at?new Date(conn.token_expires_at).getTime():0
  const needsRefresh=Boolean(expiresAt && expiresAt <= Date.now()+60_000)
  if(!needsRefresh) return conn.access_token as string
  if(!conn.refresh_token) throw new Error('HMRC agent ASA session expired. Reconnect this agent ASA to HMRC.')

  return refreshStoredToken('agent_hmrc_connections','agent_id',agentId,workspace.firmId,conn)
}

export async function getHmrcAccessTokenForActingCapacity(taxpayerId:string,agentId?:string|null){
  await assertTaxpayerAccess(taxpayerId)
  if(agentId) return getValidAgentHmrcAccessToken(agentId)
  return getValidHmrcAccessToken(taxpayerId)
}
