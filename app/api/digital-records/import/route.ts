import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

function taxYear(d:string){const x=new Date(`${d}T12:00:00Z`);const y=x.getUTCFullYear(),m=x.getUTCMonth()+1,day=x.getUTCDate();const s=m>4||(m===4&&day>=6)?y:y-1;return `${s}-${String(s+1).slice(-2)}`}
function parseCsv(text:string){const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);cell='';if(row.some(v=>v.trim()!==''))rows.push(row);row=[]}else cell+=c}row.push(cell);if(row.some(v=>v.trim()!==''))rows.push(row);return rows}

export async function POST(req:Request){
 const f=await req.formData();const taxpayerId=String(f.get('taxpayerId')||'');const file=f.get('file');const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/digital-records`,req.url)
 if(!taxpayerId||!(file instanceof File)){back.searchParams.set('error','Choose a CSV file to import.');return NextResponse.redirect(back,303)}
 if(file.size>2_000_000){back.searchParams.set('error','CSV file is too large. Maximum size is 2 MB.');return NextResponse.redirect(back,303)}
 const rows=parseCsv(await file.text());if(rows.length<2){back.searchParams.set('error','CSV must contain a header row and at least one digital record.');return NextResponse.redirect(back,303)}
 const header=rows[0].map(v=>v.trim().toLowerCase());const required=['business_id','date','type','category','amount'];for(const h of required)if(!header.includes(h)){back.searchParams.set('error',`CSV is missing required column: ${h}`);return NextResponse.redirect(back,303)}
 const idx=(k:string)=>header.indexOf(k);const db=supabaseAdmin();const {data:businesses}=await db.from('hmrc_businesses').select('business_id').eq('taxpayer_id',taxpayerId);const allowed=new Set((businesses||[]).map((b:any)=>String(b.business_id)));let imported=0,skipped=0;const inserts:any[]=[]
 for(let r=1;r<rows.length;r++){const line=rows[r];const businessId=String(line[idx('business_id')]||'').trim();const transactionDate=String(line[idx('date')]||'').trim();const recordType=String(line[idx('type')]||'').trim().toLowerCase();const category=String(line[idx('category')]||'').trim();const amount=Number(String(line[idx('amount')]||'').replace(/£|,/g,''));const description=idx('description')>=0?String(line[idx('description')]||'').trim():'';const documentRef=idx('document_reference')>=0?String(line[idx('document_reference')]||'').trim():''
  if(!allowed.has(businessId)||!/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)||!['income','expense'].includes(recordType)||!category||!Number.isFinite(amount)||amount<0){skipped++;continue}
  const {data:dupe}=await db.from('mtd_digital_records').select('id').eq('taxpayer_id',taxpayerId).eq('business_id',businessId).eq('transaction_date',transactionDate).eq('record_type',recordType).eq('category',category).eq('amount',amount).limit(1)
  if(dupe?.length){skipped++;continue}
  inserts.push({taxpayer_id:taxpayerId,business_id:businessId,tax_year:taxYear(transactionDate),transaction_date:transactionDate,record_type:recordType,category,description:description||null,amount,source:'csv',document_url:documentRef||null})
 }
 if(inserts.length){const {error}=await db.from('mtd_digital_records').insert(inserts);if(error){back.searchParams.set('error',error.message);return NextResponse.redirect(back,303)}imported=inserts.length}
 back.searchParams.set('imported',String(imported));back.searchParams.set('skipped',String(skipped));return NextResponse.redirect(back,303)
}
