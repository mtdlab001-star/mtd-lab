import {cookies} from 'next/headers'
import {configuredAppUsername,readAppSessionUsername} from '@/lib/app-auth'
import {supabaseAdmin} from '@/lib/supabase-admin'

export type AppWorkspace={
  username:string
  firmId:string
  firmName:string
  role:string
  superAdmin:boolean
}

export async function currentWorkspace():Promise<AppWorkspace|null>{
  const store=await cookies()
  const username=await readAppSessionUsername(store.get('mtdlab_session')?.value)
  if(!username)return null
  const db=supabaseAdmin()
  if(username===configuredAppUsername()){
    const {data:firm}=await db.from('accounting_firms').select('id,firm_name,status').eq('firm_name','MTD Lab Legacy Workspace').eq('status','approved').maybeSingle()
    if(!firm)return null
    return {username,firmId:firm.id,firmName:firm.firm_name,role:'super_admin',superAdmin:true}
  }
  const {data:user}=await db.from('app_users').select('username,role,status,firm_id,accounting_firms!inner(id,firm_name,status)').eq('username',username).eq('status','approved').maybeSingle()
  const firm=Array.isArray((user as any)?.accounting_firms)?(user as any).accounting_firms[0]:(user as any)?.accounting_firms
  if(!user||!firm||firm.status!=='approved')return null
  return {username:user.username,firmId:user.firm_id,firmName:firm.firm_name,role:user.role,superAdmin:false}
}

export async function taxpayerBelongsToWorkspace(taxpayerId:string,workspace?:AppWorkspace|null){
  const ws=workspace===undefined?await currentWorkspace():workspace
  if(!ws)return false
  const {data}=await supabaseAdmin().from('taxpayers').select('id').eq('id',taxpayerId).eq('firm_id',ws.firmId).maybeSingle()
  return Boolean(data)
}
