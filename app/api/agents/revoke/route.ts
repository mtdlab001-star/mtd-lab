import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isSameOriginRequest } from '@/lib/request-security'

export async function POST(req:Request){
  if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
  const form=await req.formData()
  const taxpayerId=String(form.get('taxpayerId')||'').trim()
  const authorisationId=String(form.get('authorisationId')||'').trim()
  const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/agents`,req.url)
  if(!taxpayerId||!authorisationId){back.searchParams.set('error','Agent authorisation could not be identified.');return NextResponse.redirect(back,303)}
  try{
    const db=supabaseAdmin();const {data,error}=await db.from('mtd_agent_authorisations').update({status:'revoked',revoked_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',authorisationId).eq('taxpayer_id',taxpayerId).select('id').maybeSingle()
    if(error)throw error
    if(!data){back.searchParams.set('error','Agent authorisation was not found for this taxpayer.');return NextResponse.redirect(back,303)}
    back.searchParams.set('revoked','1');return NextResponse.redirect(back,303)
  }catch(e:any){back.searchParams.set('error',e?.message||'Could not revoke agent authorisation.');return NextResponse.redirect(back,303)}
}
