'use client'

import { useEffect } from 'react'

const selector='form[action="/api/hmrc/quarterly/prepare"]'

function hydrate(form:HTMLFormElement){
  const taxpayerId=(form.elements.namedItem('taxpayerId') as HTMLInputElement|null)?.value||''
  const businessId=(form.elements.namedItem('businessId') as HTMLInputElement|null)?.value||''
  const incomeSourceType=(form.elements.namedItem('incomeSourceType') as HTMLInputElement|null)?.value||''
  const periodEnd=(form.elements.namedItem('periodEnd') as HTMLInputElement|null)?.value||''
  if(!taxpayerId||!businessId||!incomeSourceType||!periodEnd)return
  const params=new URLSearchParams({taxpayerId,businessId,incomeSourceType,periodEnd})
  fetch(`/api/hmrc/quarterly/draft?${params.toString()}`,{credentials:'same-origin',cache:'no-store'})
    .then(r=>r.ok?r.json():null)
    .then(data=>{
      const figures=data?.figures
      if(!figures||typeof figures!=='object')return
      for(const [key,value] of Object.entries(figures)){
        const field=form.elements.namedItem(key)
        if(field instanceof HTMLInputElement&&field.type==='number'&&value!==null&&value!==undefined){
          field.value=String(value)
        }
      }
      form.dataset.quarterlyDraftRestored='true'
    })
    .catch(()=>{})
}

export default function QuarterlyDraftHydrator(){
  useEffect(()=>{
    const run=()=>document.querySelectorAll<HTMLFormElement>(selector).forEach(form=>{
      if(form.dataset.quarterlyDraftHydrated==='true')return
      form.dataset.quarterlyDraftHydrated='true'
      hydrate(form)
    })
    run()
    const observer=new MutationObserver(run)
    observer.observe(document.body,{childList:true,subtree:true})
    return()=>observer.disconnect()
  },[])
  return null
}
