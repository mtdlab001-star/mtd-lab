import { refreshAccessToken } from '@/lib/hmrc'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function getValidHmrcAccessToken(taxpayerId:string){
  const db=supabaseAdmin()
  const {data:conn,error}=await db.from('hmrc_connections').select('*').eq('taxpayer_id',taxpayerId).maybeSingle()
  if(error||!conn?.access_token) throw new Error('Connect this taxpayer to HMRC first')

  const expiresAt=conn.token_expires_at?new Date(conn.token_expires_at).getTime():0
  const needsRefresh=Boolean(expiresAt && expiresAt <= Date.now()+60_000)
  if(!needsRefresh) return conn.access_token as string
  if(!conn.refresh_token) throw new Error('HMRC session expired. Reconnect this taxpayer to HMRC.')

  const token=await refreshAccessToken(conn.refresh_token)
  const nextExpiresAt=new Date(Date.now()+token.expires_in*1000).toISOString()
  const {error:updateError}=await db.from('hmrc_connections').update({
    access_token:token.access_token,
    refresh_token:token.refresh_token||conn.refresh_token,
    token_expires_at:nextExpiresAt,
    scope:token.scope||conn.scope||null,
    updated_at:new Date().toISOString()
  }).eq('taxpayer_id',taxpayerId)
  if(updateError) throw new Error(`Could not save refreshed HMRC token: ${updateError.message}`)
  return token.access_token
}
