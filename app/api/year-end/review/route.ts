import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const allowedSections=new Set(['adjustments','tax-liability','reliefs','other-income','state-benefits','employment'])
const allowedStatuses=new Set(['reviewed','not_applicable','action_required'])

export async function POST(req:Request){
 const form=await req.formData();const taxpayerId=String(form.get('taxpayerId')||'');const taxYear=String(form.get('taxYear')||'');const section=String(form.get('section')||'');const status=String(form.get('status')||'reviewed');const note=String(form.get('note')||'').trim()
 const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/end-of-year`,req.url);back.searchParams.set('taxYear',taxYear)
 if(!taxpayerId||!/^20\d{2}-\d{2}$/.test(taxYear)||!allowedSections.has(section)||!allowedStatuses.has(status)){back.searchParams.set('reviewError','Invalid year end review update');return NextResponse.redirect(back,303)}
 const now=new Date().toISOString();const {error}=await supabaseAdmin().from('mtd_year_end_reviews').upsert({taxpayer_id:taxpayerId,tax_year:taxYear,section,status,note:note||null,reviewed_at:now,updated_at:now},{onConflict:'taxpayer_id,tax_year,section'})
 if(error){back.searchParams.set('reviewError','Could not save year end review status');return NextResponse.redirect(back,303)}
 back.searchParams.set('reviewSaved',section);return NextResponse.redirect(back,303)
}
