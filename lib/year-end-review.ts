import { supabaseAdmin } from '@/lib/supabase-admin'

export async function markYearEndReviewed(taxpayerId:string,taxYear:string,section:string,note?:string){
 try{
  await supabaseAdmin().from('mtd_year_end_reviews').upsert({taxpayer_id:taxpayerId,tax_year:taxYear,section,status:'reviewed',note:note||null,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:'taxpayer_id,tax_year,section'})
 }catch{}
}
