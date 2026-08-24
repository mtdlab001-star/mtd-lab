import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isSameOriginRequest } from '@/lib/request-security'
import { listMtdIncomeSources, type MtdIncomeSourceRecord } from '@/lib/mtd-income-sources-server'
import { validateCsvRows } from '@/lib/digital-records-validation'
import { recordDigitalRecordAudit } from '@/lib/digital-record-audit'

export async function POST(req:Request){
 if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
 const form=await req.formData();const taxpayerId=String(form.get('taxpayerId')||'');const selectedBusinessId=String(form.get('businessId')||'');const requestedSourceType=String(form.get('sourceType')||'');const file=form.get('file');const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/digital-records`,req.url)
 if(selectedBusinessId)back.searchParams.set('businessId',selectedBusinessId);if(requestedSourceType)back.searchParams.set('sourceType',requestedSourceType)
 if(!taxpayerId||!(file instanceof File)){back.searchParams.set('error','Choose a CSV file to import.');return NextResponse.redirect(back,303)}
 if(file.size>2_000_000){back.searchParams.set('error','CSV file is too large. Maximum size is 2 MB.');return NextResponse.redirect(back,303)}
 if(file.type&&!['text/csv','application/csv','application/vnd.ms-excel','text/plain'].includes(file.type)){back.searchParams.set('error','Upload a CSV text file using the MTD Lab template.');return NextResponse.redirect(back,303)}
 const db=supabaseAdmin();let sources:MtdIncomeSourceRecord[]
 try{sources=await listMtdIncomeSources(db,taxpayerId)}catch(e:any){back.searchParams.set('error',e.message||'Could not validate HMRC income sources.');return NextResponse.redirect(back,303)}
 const selected=selectedBusinessId?sources.find(source=>source.businessId===selectedBusinessId):null
 if(selectedBusinessId&&!selected){back.searchParams.set('error','The selected HMRC income source does not belong to this taxpayer.');return NextResponse.redirect(back,303)}
 if(selected&&requestedSourceType&&selected.sourceType!==requestedSourceType){back.searchParams.set('error','The selected HMRC income source type does not match this record lane.');return NextResponse.redirect(back,303)}
 if(selected)back.searchParams.set('sourceType',selected.sourceType)
 const validation=validateCsvRows({text:await file.text(),taxpayerId,selectedBusinessId,requestedSourceType,sources})
 const inserts:any[]=[];const issues=[...validation.issues]
 for(let index=0;index<validation.inserts.length;index++){
  const candidate=validation.inserts[index]
  const {data:duplicate}=await db.from('mtd_digital_records').select('id').eq('taxpayer_id',taxpayerId).eq('business_id',candidate.business_id).eq('transaction_date',candidate.transaction_date).eq('record_type',candidate.record_type).eq('category',candidate.category).eq('amount',candidate.amount).limit(1)
  if(duplicate?.length)issues.push({row:validation.rowNumbers[index]||index+2,message:'duplicate of an existing digital record'});else inserts.push(candidate)
 }
 if(inserts.length){const {error}=await db.from('mtd_digital_records').insert(inserts);if(error){back.searchParams.set('error',error.message);return NextResponse.redirect(back,303)}await recordDigitalRecordAudit(db,{taxpayerId,businessId:selectedBusinessId,taxYear:inserts[0]?.tax_year,eventType:'digital_records_imported',summary:{fileName:file.name,sourceType:selected?.sourceType||requestedSourceType,imported:inserts.length,skipped:issues.length}})}
 back.searchParams.set('imported',String(inserts.length));back.searchParams.set('skipped',String(issues.length))
 if(issues.length)back.searchParams.set('importIssues',Buffer.from(JSON.stringify(issues.slice(0,20)),'utf8').toString('base64url'))
 return NextResponse.redirect(back,303)
}
