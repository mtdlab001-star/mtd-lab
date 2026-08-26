import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getValidAgentHmrcAccessToken } from '@/lib/hmrc-connection'
import { hmrcApiBase } from '@/lib/hmrc'
import { isSameOriginRequest } from '@/lib/request-security'

const ACCEPT_V1='application/vnd.hmrc.1.0+json'
const ACCEPT_V2='application/vnd.hmrc.2.0+json'

function cleanPostcode(value:string){return value.trim().toUpperCase().replace(/\s+/g,' ')}
function cleanArn(value:string){return value.trim().toUpperCase().replace(/\s+/g,'')}
function errorMessage(payload:any,status:number){return payload?.message||payload?.code||`HMRC ${status}`}
async function jsonOrEmpty(res:Response){const text=await res.text();if(!text)return {};try{return JSON.parse(text)}catch{return {raw:text}}}

export async function POST(req:Request){
  if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
  const form=await req.formData()
  const taxpayerId=String(form.get('taxpayerId')||'').trim()
  const agentId=String(form.get('agentId')||'').trim()
  const knownFact=cleanPostcode(String(form.get('knownFact')||''))
  const agentType=String(form.get('agentType')||'main')==='supporting'?'supporting':'main'
  const action=String(form.get('action')||'check')
  const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/agents`,req.url)

  if(!taxpayerId||!agentId||!knownFact){back.searchParams.set('error','Taxpayer, agent and client postcode are required for the HMRC relationship check.');return NextResponse.redirect(back,303)}

  const db=supabaseAdmin()
  try{
    const [{data:taxpayer,error:taxpayerError},{data:agent,error:agentError},{data:authorisation,error:authError}]=await Promise.all([
      db.from('taxpayers').select('nino').eq('id',taxpayerId).maybeSingle(),
      db.from('mtd_agents').select('hmrc_arn,status').eq('id',agentId).maybeSingle(),
      db.from('mtd_agent_authorisations').select('status,revoked_at,expires_at').eq('taxpayer_id',taxpayerId).eq('agent_id',agentId).maybeSingle()
    ])
    if(taxpayerError)throw taxpayerError;if(agentError)throw agentError;if(authError)throw authError
    if(!taxpayer?.nino)throw new Error('This taxpayer does not have a NINO recorded.')
    if(!agent?.hmrc_arn)throw new Error('This agent does not have an HMRC Agent Reference Number recorded.')
    if(agent.status&&agent.status!=='active')throw new Error('This agent is inactive in MTD Lab.')
    if(!authorisation||authorisation.status!=='authorised'||authorisation.revoked_at)throw new Error('This agent is not authorised for this taxpayer inside MTD Lab.')
    if(authorisation.expires_at&&new Date(authorisation.expires_at).getTime()<=Date.now())throw new Error('This MTD Lab agent authorisation has expired.')

    const arn=cleanArn(agent.hmrc_arn)
    const nino=String(taxpayer.nino).trim().toUpperCase()
    const accessToken=await getValidAgentHmrcAccessToken(agentId)
    const relationshipPayload={service:'MTD-IT',clientIdType:'ni',clientId:nino,knownFact,agentType}

    const checkRelationship=async()=>{
      const res=await fetch(`${hmrcApiBase}/agents/${encodeURIComponent(arn)}/relationships`,{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,Accept:ACCEPT_V1,'Content-Type':'application/json'},body:JSON.stringify(relationshipPayload),cache:'no-store'})
      const payload=await jsonOrEmpty(res)
      if(res.status===204)return {active:true,payload}
      if(res.status===404)return {active:false,payload}
      throw new Error(errorMessage(payload,res.status))
    }

    if(action==='check'){
      const result=await checkRelationship()
      back.searchParams.set('hmrcRelationship',result.active?'active':'inactive')
      return NextResponse.redirect(back,303)
    }

    if(action!=='createSandbox')throw new Error('Unknown HMRC relationship action.')
    if(process.env.HMRC_ENVIRONMENT==='production')throw new Error('Automatic relationship acceptance is sandbox only. In production the client must accept the HMRC authorisation request.')

    const invitationPayload={service:'MTD-IT',clientType:'personal',clientIdType:'ni',clientId:nino,knownFact,agentType}
    const invitationRes=await fetch(`${hmrcApiBase}/agents/${encodeURIComponent(arn)}/invitations`,{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,Accept:ACCEPT_V2,'Content-Type':'application/json'},body:JSON.stringify(invitationPayload),cache:'no-store'})
    const invitationBody=await jsonOrEmpty(invitationRes)
    if(invitationRes.status!==204)throw new Error(errorMessage(invitationBody,invitationRes.status))
    const location=invitationRes.headers.get('location')||''
    const invitationId=location.split('/').filter(Boolean).pop()
    if(!invitationId)throw new Error('HMRC created the authorisation request but did not return an invitation ID.')

    const acceptRes=await fetch(`${hmrcApiBase}/agent-authorisation-test-support/invitations/${encodeURIComponent(invitationId)}`,{method:'PUT',headers:{Accept:ACCEPT_V1,'Content-Length':'0'},cache:'no-store'})
    const acceptBody=await jsonOrEmpty(acceptRes)
    if(acceptRes.status!==204)throw new Error(errorMessage(acceptBody,acceptRes.status))

    const result=await checkRelationship()
    if(!result.active)throw new Error('HMRC accepted the sandbox invitation, but the agent relationship is not active yet. Try Check HMRC relationship again.')
    back.searchParams.set('hmrcRelationship','active')
    back.searchParams.set('hmrcInvitationAccepted','1')
    return NextResponse.redirect(back,303)
  }catch(e:any){
    back.searchParams.set('error',e?.message||'Could not verify HMRC agent relationship.')
    return NextResponse.redirect(back,303)
  }
}
