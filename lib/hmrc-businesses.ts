function businessId(business:any){
  return String(business?.incomeSourceId||business?.businessId||'').trim()
}

export function hmrcBusinessType(business:any){
  return business?.incomeSourceType||business?.typeOfBusiness||business?.type||null
}

export function mergeBusinessPayloads(payloads:any[]){
  const businesses=new Map<string,any>()
  for(const payload of payloads){
    const list=Array.isArray(payload?.listOfBusinesses)?payload.listOfBusinesses:[]
    for(const business of list){
      const id=businessId(business)
      if(id&&!businesses.has(id))businesses.set(id,business)
    }
  }
  return Array.from(businesses.values())
}
