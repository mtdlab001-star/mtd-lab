function businessId(business:any){
  return String(business?.incomeSourceId||business?.businessId||'').trim()
}

function businessType(business:any){
  return business?.incomeSourceType||business?.typeOfBusiness||business?.type||null
}

function sandboxBusinessType(id:string){
  const normalised=id.trim().toUpperCase()
  if(normalised.startsWith('XBIS'))return 'self-employment'
  if(normalised.startsWith('XPIS'))return 'uk-property'
  if(normalised.startsWith('XFIS'))return 'foreign-property'
  return null
}

/**
 * HMRC's dynamic obligations sandbox can return its canned XPIS/XFIS business
 * IDs even when the stateful Business Details API created different property
 * IDs for the taxpayer. Reconcile only a single unambiguous sandbox business
 * of the same type. Production always keeps HMRC's exact identifier.
 */
export function reconcileSandboxObligationBusinessIds(rows:any[],businesses:any[],environment:string|undefined){
  if(environment==='production')return rows

  const knownIds=new Set(businesses.map(businessId).filter(Boolean))
  const businessesByType=new Map<string,any[]>()
  for(const business of businesses){
    const type=businessType(business)
    const id=businessId(business)
    if(!type||!id)continue
    businessesByType.set(type,[...(businessesByType.get(type)||[]),business])
  }

  return rows.map(row=>{
    const sourceId=String(row?.businessId||'').trim()
    if(!sourceId||knownIds.has(sourceId))return row

    const type=sandboxBusinessType(sourceId)
    const candidates=type?businessesByType.get(type)||[]:[]
    if(candidates.length!==1)return row

    const mappedId=businessId(candidates[0])
    return {
      ...row,
      businessId:mappedId,
      sandboxSourceBusinessId:sourceId,
      sandboxBusinessIdRemapped:true,
    }
  })
}
