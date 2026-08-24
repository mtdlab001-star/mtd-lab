export async function recordDigitalRecordAudit(db:any,args:{taxpayerId:string;businessId:string;taxYear?:string|null;eventType:string;status?:string;summary?:Record<string,unknown>}){
  const {error}=await db.from('mtd_submission_audit').insert({taxpayer_id:args.taxpayerId,business_id:args.businessId||null,tax_year:args.taxYear||null,event_type:args.eventType,status:args.status||'completed',request_summary:args.summary||{}})
  if(error)console.error('Digital record audit failed',error.message)
}
