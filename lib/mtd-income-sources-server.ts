import 'server-only'
import { incomeSourceType, incomeSourceTypeFromBusinessId, type MtdIncomeSourceType } from '@/lib/mtd-income-source'

export type MtdIncomeSourceRecord={businessId:string;businessName:string|null;sourceType:MtdIncomeSourceType;fallback:boolean}

export function mergeMtdIncomeSources(businesses:any[],obligations:any[]):MtdIncomeSourceRecord[]{
  const sources=new Map<string,MtdIncomeSourceRecord>()
  for(const business of businesses||[]){const businessId=String(business.business_id||'').trim();if(businessId)sources.set(businessId,{businessId,businessName:business.business_name||null,sourceType:incomeSourceType(business),fallback:false})}
  for(const obligation of obligations||[]){const businessId=String(obligation.business_id||'').trim();if(businessId&&!sources.has(businessId))sources.set(businessId,{businessId,businessName:null,sourceType:incomeSourceTypeFromBusinessId(businessId),fallback:true})}
  const order:Record<MtdIncomeSourceType,number>={'self-employment':0,'uk-property':1,'foreign-property':2}
  return Array.from(sources.values()).sort((a,b)=>order[a.sourceType]-order[b.sourceType]||String(a.businessName||a.businessId).localeCompare(String(b.businessName||b.businessId)))
}

export async function listMtdIncomeSources(db:any,taxpayerId:string):Promise<MtdIncomeSourceRecord[]>{
  const [{data:businesses,error:businessError},{data:obligations,error:obligationError}]=await Promise.all([
    db.from('hmrc_businesses').select('business_id,business_type,business_name,raw').eq('taxpayer_id',taxpayerId),
    db.from('hmrc_obligations').select('business_id').eq('taxpayer_id',taxpayerId).not('business_id','is',null)
  ])
  if(businessError)throw businessError
  if(obligationError)throw obligationError
  return mergeMtdIncomeSources(businesses||[],obligations||[])
}
