import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isSameOriginRequest } from '@/lib/request-security'
import { listMtdIncomeSources, type MtdIncomeSourceRecord } from '@/lib/mtd-income-sources-server'

function taxYear(d:string){const x=new Date(`${d}T12:00:00Z`);const y=x.getUTCFullYear(),m=x.getUTCMonth()+1,day=x.getUTCDate();const s=m>4||(m===4&&day>=6)?y:y-1;return `${s}-${String(s+1).slice(-2)}`}
function parseCsv(text:string){const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);cell='';if(row.some(v=>v.trim()!==''))rows.push(row);row=[]}else cell+=c}row.push(cell);if(row.some(v=>v.trim()!==''))rows.push(row);return rows}

export async function POST(req:Request){
 if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
 const f=await req.formData()
 const taxpayerId=String(f.get('taxpayerId')||'')
 const selectedBusinessId=String(f.get('businessId')||'')
 const requestedSourceType=String(f.get('sourceType')||'')
 const file=f.get('file')
 const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/digital-records`,req.url)
 if(selectedBusinessId)back.searchParams.set('businessId',selectedBusinessId)
 if(requestedSourceType)back.searchParams.set('sourceType',requestedSourceType)
 if(!taxpayerId||!(file instanceof File)){back.searchParams.set('error','Choose a CSV file to import.');return NextResponse.redirect(back,303)}
 if(file.size>2_000_000){back.searchParams.set('error','CSV file is too large. Maximum size is 2 MB.');return NextResponse.redirect(back,303)}
 const rows=parseCsv(await file.text())
 if(rows.length<2){back.searchParams.set('error','CSV must contain a header row and at least one digital record.');return NextResponse.redirect(back,303)}
 const header=rows[0].map(v=>v.trim().toLowerCase())
 const required=['business_id','date','type','category','amount']
 for(const h of required)if(!header.includes(h)){back.searchParams.set('error',`CSV is missing required column: ${h}`);return NextResponse.redirect(back,303)}
 const idx=(k:string)=>header.indexOf(k)
 const db=supabaseAdmin()
 let sources:MtdIncomeSourceRecord[]
 try{sources=await listMtdIncomeSources(db,taxpayerId)}catch(e:any){back.searchParams.set('error',e.message||'Could not validate HMRC income sources.');return NextResponse.redirect(back,303)}
 const allowed=new Map(sources.map(source=>[source.businessId,source]))
 const selected=selectedBusinessId?allowed.get(selectedBusinessId):null
 if(selectedBusinessId&&!selected){back.searchParams.set('error','The selected HMRC income source does not belong to this taxpayer.');return NextResponse.redirect(back,303)}
 if(selected&&requestedSourceType&&selected.sourceType!==requestedSourceType){back.searchParams.set('error','The selected HMRC income source type does not match this record lane.');return NextResponse.redirect(back,303)}
 if(selected)back.searchParams.set('sourceType',selected.sourceType)
 let imported=0,skipped=0
 const inserts:any[]=[]
 const pending=new Set<string>()
 for(let r=1;r<rows.length;r++){
  const line=rows[r]
  const businessId=String(line[idx('business_id')]||'').trim()
  const transactionDate=String(line[idx('date')]||'').trim()
  const recordType=String(line[idx('type')]||'').trim().toLowerCase()
  const category=String(line[idx('category')]||'').trim()
  const amount=Number(String(line[idx('amount')]||'').replace(/£|,/g,''))
  const description=idx('description')>=0?String(line[idx('description')]||'').trim():''
  const documentRef=idx('document_reference')>=0?String(line[idx('document_reference')]||'').trim():''
  const source=allowed.get(businessId)
  if(!source||(selectedBusinessId&&businessId!==selectedBusinessId)||(requestedSourceType&&source.sourceType!==requestedSourceType)||!/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)||!['income','expense'].includes(recordType)||!category||!Number.isFinite(amount)||amount<0){skipped++;continue}
  const signature=[businessId,transactionDate,recordType,category,amount].join('|')
  if(pending.has(signature)){skipped++;continue}
  const {data:dupe}=await db.from('mtd_digital_records').select('id').eq('taxpayer_id',taxpayerId).eq('business_id',businessId).eq('transaction_date',transactionDate).eq('record_type',recordType).eq('category',category).eq('amount',amount).limit(1)
  if(dupe?.length){skipped++;continue}
  pending.add(signature)
  inserts.push({taxpayer_id:taxpayerId,business_id:businessId,tax_year:taxYear(transactionDate),transaction_date:transactionDate,record_type:recordType,category,description:description||null,amount,source:'csv',document_url:documentRef||null})
 }
 if(inserts.length){const {error}=await db.from('mtd_digital_records').insert(inserts);if(error){back.searchParams.set('error',error.message);return NextResponse.redirect(back,303)}imported=inserts.length}
 back.searchParams.set('imported',String(imported))
 back.searchParams.set('skipped',String(skipped))
 return NextResponse.redirect(back,303)
}
