import { currentWorkspace } from '@/lib/workspace'

async function firmId(){const workspace=await currentWorkspace();return workspace?.firmId||''}

export async function recordHmrcResponse(db:any,args:{taxpayerId:string;taxYear:string;eventType:string;status:'accepted'|'rejected';payload:any;correlationId?:string|null;hmrcStatus?:number|null;requestSummary?:Record<string,any>}){
  const workspaceFirmId=await firmId();if(!workspaceFirmId)return ''
  const {data,error}=await db.from('mtd_submission_audit').insert({
    firm_id:workspaceFirmId,
    taxpayer_id:args.taxpayerId,
    tax_year:args.taxYear,
    event_type:args.eventType,
    status:args.status,
    hmrc_correlation_id:args.correlationId||null,
    hmrc_status:args.hmrcStatus||null,
    request_summary:args.requestSummary||{},
    response_summary:args.payload,
    created_at:new Date().toISOString(),
  }).select('id').maybeSingle()
  if(error)console.error('HMRC response audit failed',error.message)
  return data?.id?String(data.id):''
}

export async function latestHmrcResponse(db:any,args:{taxpayerId:string;taxYear:string;eventType:string;requestKey?:string;requestValue?:string}){
  const workspaceFirmId=await firmId();if(!workspaceFirmId)return null
  const query=db.from('mtd_submission_audit').select('id,response_summary,response_payload,hmrc_correlation_id,created_at,request_summary').eq('firm_id',workspaceFirmId).eq('taxpayer_id',args.taxpayerId).eq('tax_year',args.taxYear).eq('event_type',args.eventType).eq('status','accepted').order('created_at',{ascending:false}).limit(10)
  const {data}=await query
  const rows=data||[]
  const requestKey=args.requestKey
  const row=requestKey?rows.find((r:any)=>String(r?.request_summary?.[requestKey]||'')===String(args.requestValue||'')):rows[0]
  return row||null
}

export async function latestHmrcAttempt(db:any,args:{taxpayerId:string;taxYear:string;eventType:string;requestKey?:string;requestValue?:string}){
  const workspaceFirmId=await firmId();if(!workspaceFirmId)return null
  const {data}=await db.from('mtd_submission_audit')
    .select('id,status,hmrc_status,response_summary,response_payload,hmrc_correlation_id,created_at,request_summary')
    .eq('firm_id',workspaceFirmId)
    .eq('taxpayer_id',args.taxpayerId)
    .eq('tax_year',args.taxYear)
    .eq('event_type',args.eventType)
    .order('created_at',{ascending:false})
    .limit(25)
  const rows=data||[]
  const requestKey=args.requestKey
  const row=requestKey?rows.find((r:any)=>String(r?.request_summary?.[requestKey]||'')===String(args.requestValue||'')):rows[0]
  return row||null
}
