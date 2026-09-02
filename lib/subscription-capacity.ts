import {supabaseAdmin} from '@/lib/supabase-admin'
import type {AppWorkspace} from '@/lib/workspace'

export type ClientCapacity={
  exempt:boolean
  capacity:number
  used:number
  remaining:number
  canAdd:boolean
  status:string
}

export async function getClientCapacity(workspace:AppWorkspace):Promise<ClientCapacity>{
  if(workspace.superAdmin)return {exempt:true,capacity:Number.MAX_SAFE_INTEGER,used:0,remaining:Number.MAX_SAFE_INTEGER,canAdd:true,status:'super_admin'}
  const db=supabaseAdmin()
  const [{data:subscription,error:subscriptionError},{count:used,error:countError}]=await Promise.all([
    db.from('firm_subscriptions').select('status,base_capacity,addon_capacity').eq('firm_id',workspace.firmId).maybeSingle(),
    db.from('taxpayers').select('id',{count:'exact',head:true}).eq('firm_id',workspace.firmId).is('archived_at',null)
  ])
  if(subscriptionError)throw subscriptionError
  if(countError)throw countError
  const capacity=Math.max(0,Number(subscription?.base_capacity||0)+Number(subscription?.addon_capacity||0))
  const active=used||0
  return {exempt:false,capacity,used:active,remaining:Math.max(0,capacity-active),canAdd:capacity>active,status:String(subscription?.status||'unconfigured')}
}

export async function assertClientCapacity(workspace:AppWorkspace){
  const result=await getClientCapacity(workspace)
  if(!result.canAdd)throw new Error(result.capacity>0?`Client limit reached (${result.used}/${result.capacity}). Add client capacity in Plans & Billing before adding another client.`:'No client capacity is assigned to this firm yet. Choose or assign a client bundle in Plans & Billing before adding a client.')
  return result
}
