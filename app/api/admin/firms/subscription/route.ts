import {NextResponse} from 'next/server'
import {cookies} from 'next/headers'
import {configuredAppUsername,readAppSessionUsername} from '@/lib/app-auth'
import {supabaseAdmin} from '@/lib/supabase-admin'
import {isSameOriginRequest} from '@/lib/request-security'

function back(req:Request,message:string,type:'success'|'error'='success'){
  const url=new URL('/admin/firms',req.url)
  url.searchParams.set(type,message)
  return NextResponse.redirect(url,303)
}

export async function POST(req:Request){
  if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
  const jar=await cookies()
  const username=await readAppSessionUsername(jar.get('mtdlab_session')?.value)
  if(!username||username!==configuredAppUsername())return new NextResponse('Forbidden',{status:403})

  const form=await req.formData()
  const firmId=String(form.get('firmId')||'').trim()
  const baseCapacity=Number(form.get('baseCapacity'))
  const addonCapacity=Number(form.get('addonCapacity'))
  const status=String(form.get('subscriptionStatus')||'prelaunch')
  const allowedStatuses=new Set(['prelaunch','trial','active','past_due','cancelled','suspended'])

  if(!firmId)return back(req,'A firm is required.','error')
  if(!Number.isInteger(baseCapacity)||baseCapacity<0)return back(req,'Choose a valid base client bundle.','error')
  if(!Number.isInteger(addonCapacity)||addonCapacity<0||addonCapacity>10000)return back(req,'Add-on capacity must be between 0 and 10,000.','error')
  if(!allowedStatuses.has(status))return back(req,'Choose a valid subscription status.','error')

  const db=supabaseAdmin()
  const [{data:firm,error:firmError},{data:bundle,error:bundleError},{count:activeClients,error:countError}]=await Promise.all([
    db.from('accounting_firms').select('id,firm_name').eq('id',firmId).maybeSingle(),
    baseCapacity===0?Promise.resolve({data:{client_capacity:0},error:null} as any):db.from('subscription_bundles').select('client_capacity').eq('client_capacity',baseCapacity).eq('is_active',true).maybeSingle(),
    db.from('taxpayers').select('id',{count:'exact',head:true}).eq('firm_id',firmId).is('archived_at',null)
  ])
  if(firmError||!firm)return back(req,'Accounting firm was not found.','error')
  if(bundleError||!bundle)return back(req,'The selected base bundle is not available.','error')
  if(countError)return back(req,'Active client usage could not be checked.','error')

  const totalCapacity=baseCapacity+addonCapacity
  if(totalCapacity<(activeClients||0))return back(req,`Capacity cannot be reduced below the firm's ${(activeClients||0)} active clients.`,'error')

  const now=new Date().toISOString()
  const {error}=await db.from('firm_subscriptions').upsert({
    firm_id:firmId,
    status,
    base_capacity:baseCapacity,
    addon_capacity:addonCapacity,
    updated_at:now
  },{onConflict:'firm_id'})
  if(error)return back(req,'The firm capacity could not be updated.','error')

  await db.from('firm_access_audit').insert({
    firm_id:firmId,
    action:'subscription_capacity_updated',
    actor:username,
    detail:{baseCapacity,addonCapacity,totalCapacity,status,activeClients:activeClients||0}
  })

  return back(req,`${firm.firm_name} capacity updated to ${totalCapacity} active clients.`)
}
