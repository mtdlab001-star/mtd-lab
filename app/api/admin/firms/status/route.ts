import {NextResponse} from 'next/server'
import {cookies} from 'next/headers'
import {configuredAppUsername,readAppSessionUsername} from '@/lib/app-auth'
import {supabaseAdmin} from '@/lib/supabase-admin'
import {isSameOriginRequest} from '@/lib/request-security'

const allowed=new Set(['approved','rejected','suspended'])

export async function POST(req:Request){
  if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
  const jar=await cookies()
  const username=await readAppSessionUsername(jar.get('mtdlab_session')?.value)
  if(!username||username!==configuredAppUsername())return new NextResponse('Forbidden',{status:403})

  const form=await req.formData()
  const firmId=String(form.get('firmId')||'').trim()
  const status=String(form.get('status')||'').trim()
  if(!firmId||!allowed.has(status))return new NextResponse('Invalid request',{status:400})

  const db=supabaseAdmin()
  const now=new Date().toISOString()
  const firmPatch:any={status,updated_at:now}
  if(status==='approved'){firmPatch.approved_at=now;firmPatch.approved_by=username;firmPatch.rejected_at=null;firmPatch.rejection_reason=null}
  if(status==='rejected'){firmPatch.rejected_at=now;firmPatch.approved_at=null;firmPatch.approved_by=null}
  if(status==='suspended'){firmPatch.approved_at=null}

  const {error:firmError}=await db.from('accounting_firms').update(firmPatch).eq('id',firmId)
  if(firmError)return new NextResponse('Could not update firm',{status:500})
  const {error:userError}=await db.from('app_users').update({status,approved_at:status==='approved'?now:null,updated_at:now}).eq('firm_id',firmId)
  if(userError)return new NextResponse('Firm updated but user access update failed',{status:500})
  await db.from('firm_access_audit').insert({firm_id:firmId,action:`firm_${status}`,actor:username,detail:{status}})
  return NextResponse.redirect(new URL('/admin/firms',req.url),303)
}
