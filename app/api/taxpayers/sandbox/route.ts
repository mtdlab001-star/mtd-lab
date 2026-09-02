import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isSameOriginRequest } from '@/lib/request-security'
import { currentWorkspace } from '@/lib/workspace'

function cleanNino(v:string){return v.trim().toUpperCase().replace(/\s+/g,'')}
function cleanMtditid(v:string){return v.trim().toUpperCase().replace(/\s+/g,'')}

export async function POST(req:Request){
 if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
  const workspace=await currentWorkspace()
  if(!workspace)return NextResponse.redirect(new URL('/taxpayers/sandbox?error=Accounting%20workspace%20access%20is%20not%20available',req.url),303)
  const form=await req.formData()
  const displayName=String(form.get('displayName')||'HMRC Sandbox Taxpayer').trim()
  const nino=cleanNino(String(form.get('nino')||''))
  const mtditid=cleanMtditid(String(form.get('mtditid')||''))
  if(!/^[A-Z]{2}\d{6}[A-D]$/.test(nino)) return NextResponse.redirect(new URL('/taxpayers/sandbox?error=Invalid%20NINO%20format',req.url),303)
  if(!/^[A-Z0-9]{15}$/.test(mtditid)) return NextResponse.redirect(new URL('/taxpayers/sandbox?error=Invalid%20MTD%20Income%20Tax%20ID%20format',req.url),303)
  const id=`sandbox-${randomUUID().slice(0,8)}`
  const db=supabaseAdmin()
  const {error}=await db.from('taxpayers').insert({id,firm_id:workspace.firmId,display_name:displayName||'HMRC Sandbox Taxpayer',nino,mtditid,updated_at:new Date().toISOString()})
  if(error) return NextResponse.redirect(new URL(`/taxpayers/sandbox?error=${encodeURIComponent(error.message)}`,req.url),303)
  return NextResponse.redirect(new URL(`/taxpayers/${encodeURIComponent(id)}?created=1`,req.url),303)
}
