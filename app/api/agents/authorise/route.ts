import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isSameOriginRequest } from '@/lib/request-security'
import { currentWorkspace } from '@/lib/workspace'

function checked(form:FormData,name:string){return String(form.get(name)||'')==='on'}
function cleanArn(value:string){return value.trim().toUpperCase().replace(/\s+/g,'')}
function validEmail(value:string){return !value||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)}

export async function POST(req:Request){
  if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
  const workspace=await currentWorkspace()
  if(!workspace)return new NextResponse('Accounting workspace access is not available',{status:403})
  const form=await req.formData()
  const taxpayerId=String(form.get('taxpayerId')||'').trim()
  const agentName=String(form.get('agentName')||'').trim()
  const organisationName=String(form.get('organisationName')||'').trim()||null
  const hmrcArn=cleanArn(String(form.get('hmrcArn')||''))||null
  const email=String(form.get('email')||'').trim().toLowerCase()||null
  const authorisationReference=String(form.get('authorisationReference')||'').trim()||null
  const expiresRaw=String(form.get('expiresAt')||'').trim()
  const notes=String(form.get('notes')||'').trim()||null
  const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/agents`,req.url)
  if(!taxpayerId||!agentName){back.searchParams.set('error','Taxpayer and agent name are required.');return NextResponse.redirect(back,303)}
  if(!validEmail(email||'')){back.searchParams.set('error','Enter a valid agent email address.');return NextResponse.redirect(back,303)}
  if(expiresRaw){const expiry=new Date(`${expiresRaw}T23:59:59Z`);if(Number.isNaN(expiry.getTime())||expiry<=new Date()){back.searchParams.set('error','Agent authorisation expiry must be a future date.');return NextResponse.redirect(back,303)}}
  const db=supabaseAdmin()
  try{
    const {data:taxpayer,error:taxpayerError}=await db.from('taxpayers').select('id').eq('id',taxpayerId).eq('firm_id',workspace.firmId).maybeSingle();if(taxpayerError)throw taxpayerError;if(!taxpayer){back.searchParams.set('error','Taxpayer workspace was not found.');return NextResponse.redirect(back,303)}
    let agent:any=null
    if(hmrcArn){const {data}=await db.from('mtd_agents').select('*').eq('firm_id',workspace.firmId).eq('hmrc_arn',hmrcArn).maybeSingle();agent=data}
    if(!agent&&email){const {data}=await db.from('mtd_agents').select('*').eq('firm_id',workspace.firmId).eq('email',email).maybeSingle();agent=data}
    if(!agent){const {data,error}=await db.from('mtd_agents').insert({firm_id:workspace.firmId,agent_name:agentName,organisation_name:organisationName,hmrc_arn:hmrcArn,email,status:'active',updated_at:new Date().toISOString()}).select('*').single();if(error)throw error;agent=data}else{const {error}=await db.from('mtd_agents').update({agent_name:agentName,organisation_name:organisationName,hmrc_arn:hmrcArn||agent.hmrc_arn,email:email||agent.email,status:'active',updated_at:new Date().toISOString()}).eq('id',agent.id).eq('firm_id',workspace.firmId);if(error)throw error}
    const payload:any={firm_id:workspace.firmId,taxpayer_id:taxpayerId,agent_id:agent.id,status:'authorised',can_view_records:checked(form,'canViewRecords'),can_manage_records:checked(form,'canManageRecords'),can_view_obligations:checked(form,'canViewObligations'),can_submit_quarterly:checked(form,'canSubmitQuarterly'),can_manage_year_end:checked(form,'canManageYearEnd'),can_submit_final_declaration:checked(form,'canSubmitFinalDeclaration'),authorised_at:new Date().toISOString(),revoked_at:null,expires_at:expiresRaw?new Date(`${expiresRaw}T23:59:59Z`).toISOString():null,authorisation_reference:authorisationReference,notes,updated_at:new Date().toISOString()}
    const {error}=await db.from('mtd_agent_authorisations').upsert(payload,{onConflict:'taxpayer_id,agent_id'});if(error)throw error
    back.searchParams.set('saved','1');return NextResponse.redirect(back,303)
  }catch(e:any){back.searchParams.set('error',e?.message||'Could not save agent authorisation.');return NextResponse.redirect(back,303)}
}
