import { supabaseAdmin } from '@/lib/supabase-admin'
import { currentWorkspace } from '@/lib/workspace'

export async function markYearEndReviewed(taxpayerId:string,taxYear:string,section:string,note?:string){
 try{
  const workspace=await currentWorkspace();if(!workspace)return
  const db=supabaseAdmin();const {data:taxpayer}=await db.from('taxpayers').select('id').eq('id',taxpayerId).eq('firm_id',workspace.firmId).maybeSingle();if(!taxpayer)return
  await db.from('mtd_year_end_reviews').upsert({firm_id:workspace.firmId,taxpayer_id:taxpayerId,tax_year:taxYear,section,status:'reviewed',note:note||null,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:'taxpayer_id,tax_year,section'})
 }catch{}
}
