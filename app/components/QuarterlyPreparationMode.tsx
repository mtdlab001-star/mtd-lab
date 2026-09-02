'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

function toIsoFromUk(value:string){
  const match=value.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if(!match)return ''
  return `${match[3]}-${match[2]}-${match[1]}`
}

function sourceTypeFromSelect(select:HTMLSelectElement|null){
  const text=select?.selectedOptions?.[0]?.textContent?.toLowerCase()||''
  if(text.includes('foreign property'))return 'foreign-property'
  if(text.includes('uk property'))return 'uk-property'
  return 'self-employment'
}

function installQuarterPreparationLinks(){
  const select=document.querySelector<HTMLSelectElement>('select#businessId')
  const businessId=select?.value||''
  const sourceType=sourceTypeFromSelect(select)
  document.querySelectorAll<HTMLTableRowElement>('table tbody tr').forEach(row=>{
    const cells=row.querySelectorAll<HTMLTableCellElement>('td')
    if(cells.length<6)return
    const actionCell=cells[5]
    const waiting=Array.from(actionCell.querySelectorAll('span')).find(el=>el.textContent?.trim().startsWith('Available after'))
    if(!waiting)return
    const periodText=cells[1]?.textContent||''
    const periodEnd=toIsoFromUk(periodText.split('to').pop()||'')
    if(!periodEnd||!businessId)return
    const link=document.createElement('a')
    link.className='btn btnSmall'
    link.textContent='Prepare / Review'
    link.href=`${window.location.pathname}?businessId=${encodeURIComponent(businessId)}&periodEnd=${encodeURIComponent(periodEnd)}&sourceType=${encodeURIComponent(sourceType)}`
    actionCell.replaceChildren(link)
  })
}

function installSubmissionCentreFallback(){
  const noEligible=Array.from(document.querySelectorAll('*')).some(el=>el.textContent?.trim()==='No open eligible period')
  if(!noEligible)return
  document.querySelectorAll<HTMLElement>('a,button').forEach(control=>{
    const text=control.textContent?.trim()||''
    if(!/^Review (Self Employment|UK Property|Foreign Property) update$/i.test(text))return
    if(control.dataset.preparationFallback==='1')return
    control.dataset.preparationFallback='1'
    control.addEventListener('click',event=>{
      const target=event.currentTarget as HTMLAnchorElement
      const href=target.getAttribute('href')
      if(href&&href!=='#')return
      event.preventDefault()
      const match=window.location.pathname.match(/^\/taxpayers\/([^/]+)\/submissions/)
      if(match)window.location.href=`/taxpayers/${encodeURIComponent(match[1])}/quarterly`
    })
  })
}

function installFutureSubmissionLock(){
  const cards=Array.from(document.querySelectorAll<HTMLElement>('.card'))
  const periodCard=cards.find(card=>card.textContent?.includes('Period end'))
  const dateText=periodCard?.querySelector<HTMLElement>('.dateValue')?.textContent?.trim()||''
  if(!dateText)return
  const end=new Date(`${dateText} 23:59:59`)
  if(Number.isNaN(end.getTime())||end.getTime()<=Date.now())return
  const form=Array.from(document.querySelectorAll<HTMLFormElement>('form')).find(f=>f.action.includes('/api/hmrc/quarterly/submit'))
  const button=form?.querySelector<HTMLButtonElement>('button[type="submit"]')
  if(!form||!button)return
  button.disabled=true
  button.setAttribute('aria-disabled','true')
  button.title=`HMRC submission becomes available after ${dateText}`
  button.textContent=`HMRC submission available after ${dateText}`
  if(!form.querySelector('[data-future-quarter-lock]')){
    const notice=document.createElement('div')
    notice.dataset.futureQuarterLock='1'
    notice.className='status'
    notice.style.marginBottom='12px'
    notice.innerHTML=`<strong>Preparation mode.</strong><div>Figures can be reviewed now. HMRC submission becomes available after the quarter ending ${dateText} has fully ended.</div>`
    form.prepend(notice)
  }
}

export default function QuarterlyPreparationMode(){
  const pathname=usePathname()
  useEffect(()=>{
    if(/^\/taxpayers\/[^/]+\/quarterly\/?$/.test(pathname))installQuarterPreparationLinks()
    if(/^\/taxpayers\/[^/]+\/submissions\/?$/.test(pathname))installSubmissionCentreFallback()
    if(/^\/taxpayers\/[^/]+\/quarterly\/review\/?$/.test(pathname))installFutureSubmissionLock()
  },[pathname])
  return null
}
