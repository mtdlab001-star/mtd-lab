import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

function checked(form:FormData,name:string){return String(form.get(name)||'')==='on'}

export async function POST(req:Request){
  const form=await req.formData()
  const taxpayerId=String(form.get('taxpayerId')||'').trim()
  const agentName=String(form.get('agentName')||'').trim()
  const organisationName=String(form.get('organisationName')||'').trim()||null
  const hmrcArn=String(form.get('hmrcArn')||'').trim().toUpperCase()||null
  const email=String(form.get('email')||'').trim().toLowerCase()||null
  const authorisationReference=String(form.get('authorisationReference')||'').trim()||null
  const expiresRaw=String(form.get('expiresAt')||'').trim()
  const notes=String(form.get('notes')||'').trim()||null
  const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/agents`,req.url)
  if(!taxpayerId||!agentName){back.searchParams.set('error','Taxpayer and agent name are required.');return NextResponse.redirect(back,303)}
  const db=supabaseAdmin()
  try{
    let agent:any=null
    if(hmrcArn){const {data}=await db.from('mtd_agents').select('*').eq('hmrc_arn',hmrcArn).maybeSingle();agent=data}
    if(!agent&&email){const {data}=await db.from('mtd_agents').select('*').eq('email',email).maybeSingle();agent=data}
    if(!agent){const {data,error}=await db.from('mtd_agents').insert({agent_name:agentName,organisation_name:organisationName,hmrc_arn:hmrcArn,email,status:'active',updated_at:new Date().toISOString()}).select('*').single();if(error)throw error;agent=data}else{const {error}=await db.from('mtd_agents').update({agent_name:agentName,organisation_name:organisationName,hmrc_arn:hmrcArn||agent.hmrc_arn,email:email||agent.email,status:'active',updated_at:new Date().toISOString()}).eq('id',agent.id);if(error)throw error}
    const payload:any={
      taxpayer_id:taxpayerId,agent_id:agent.id,status:'authorised',
      can_view_records:checked(form,'canViewRecords'),can_manage_records:checked(form,'canManageRecords'),
      can_view_obligations:checked(form,'canViewObligations'),can_submit_quarterly:checked(form,'canSubmitQuarterly'),
      can_manage_year_end:checked(form,'canManageYearEnd'),can_submit_final_declaration:checked(form,'canSubmitFinalDeclaration'),
      authorised_at:new Date().toISOString(),revoked_at:null,expires_at:expiresRaw?new Date(`${expiresRaw}T23:59:59Z`).toISOString():null,
      authorisation_reference:authorisationReference,notes,updated_at:new Date().toISOString()
    }
    const {error}=await db.from('mtd_agent_authorisations').upsert(payload,{onConflict:'taxpayer_id,agent_id'})
    if(error)throw error
    back.searchParams.set('saved','1');return NextResponse.redirect(back,303)
  }catch(e:any){back.searchParams.set('error',e?.message||'Could not save agent authorisation.');return NextResponse.redirect(back,303)}
}
