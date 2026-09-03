import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isSameOriginRequest } from '@/lib/request-security'
import { currentWorkspace } from '@/lib/workspace'

export async function POST(req:Request){
  if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
  const workspace=await currentWorkspace()
  if(!workspace)return new NextResponse('Accounting workspace access is not available',{status:403})
  const form=await req.formData()
  const taxpayerId=String(form.get('taxpayerId')||'').trim()
  const authorisationId=String(form.get('authorisationId')||'').trim()
  const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/agents`,req.url)
  if(!taxpayerId||!authorisationId){back.searchParams.set('error','Agent authorisation could not be identified.');return NextResponse.redirect(back,303)}
  try{
    const db=supabaseAdmin()
    const {data:taxpayer,error:taxpayerError}=await db.from('taxpayers').select('id').eq('id',taxpayerId).eq('firm_id',workspace.firmId).maybeSingle()
    if(taxpayerError)throw taxpayerError
    if(!taxpayer){back.searchParams.set('error','Taxpayer workspace was not found.');return NextResponse.redirect(back,303)}
    const {data,error}=await db.from('mtd_agent_authorisations').update({status:'revoked',revoked_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',authorisationId).eq('taxpayer_id',taxpayerId).eq('firm_id',workspace.firmId).select('id').maybeSingle()
    if(error)throw error
    if(!data){back.searchParams.set('error','Agent authorisation was not found for this taxpayer in the active accounting workspace.');return NextResponse.redirect(back,303)}
    back.searchParams.set('revoked','1');return NextResponse.redirect(back,303)
  }catch(e:any){back.searchParams.set('error',e?.message||'Could not revoke agent authorisation.');return NextResponse.redirect(back,303)}
}
