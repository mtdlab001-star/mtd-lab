import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isSameOriginRequest } from '@/lib/request-security'
import { recordDigitalRecordAudit } from '@/lib/digital-record-audit'

const allowed=new Set(['application/pdf','image/jpeg','image/png','image/webp'])
function safeName(value:string){return value.normalize('NFKC').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(-120)||'evidence'}

export async function POST(req:Request){
 if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
 const form=await req.formData();const taxpayerId=String(form.get('taxpayerId')||'');const recordId=String(form.get('recordId')||'');const businessId=String(form.get('businessId')||'');const sourceType=String(form.get('sourceType')||'');const file=form.get('file');const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/digital-records`,req.url)
 if(businessId)back.searchParams.set('businessId',businessId);if(sourceType)back.searchParams.set('sourceType',sourceType)
 if(!taxpayerId||!recordId||!(file instanceof File)){back.searchParams.set('error','Choose a supporting document.');return NextResponse.redirect(back,303)}
 if(file.size<=0||file.size>10_000_000){back.searchParams.set('error','Supporting documents must be between 1 byte and 10 MB.');return NextResponse.redirect(back,303)}
 if(!allowed.has(file.type)){back.searchParams.set('error','Supporting documents must be PDF, JPEG, PNG or WebP.');return NextResponse.redirect(back,303)}
 const db=supabaseAdmin();const {data:row}=await db.from('mtd_digital_records').select('id,taxpayer_id,business_id,tax_year,document_url').eq('id',recordId).eq('taxpayer_id',taxpayerId).maybeSingle()
 if(!row){back.searchParams.set('error','Digital record was not found.');return NextResponse.redirect(back,303)}
 const objectPath=`${taxpayerId}/${row.business_id}/${recordId}/${crypto.randomUUID()}-${safeName(file.name)}`
 const {error:uploadError}=await db.storage.from('mtd-evidence').upload(objectPath,await file.arrayBuffer(),{contentType:file.type,upsert:false,cacheControl:'3600'})
 if(uploadError){back.searchParams.set('error',uploadError.message);return NextResponse.redirect(back,303)}
 const {error:updateError}=await db.from('mtd_digital_records').update({document_url:objectPath,document_name:file.name,document_mime_type:file.type,document_size:file.size,document_uploaded_at:new Date().toISOString()}).eq('id',recordId).eq('taxpayer_id',taxpayerId)
 if(updateError){await db.storage.from('mtd-evidence').remove([objectPath]);back.searchParams.set('error',updateError.message);return NextResponse.redirect(back,303)}
 if(row.document_url)await db.storage.from('mtd-evidence').remove([row.document_url])
 await recordDigitalRecordAudit(db,{taxpayerId,businessId:row.business_id,taxYear:row.tax_year,eventType:row.document_url?'digital_record_evidence_replaced':'digital_record_evidence_uploaded',summary:{recordId,fileName:file.name,mimeType:file.type,size:file.size}})
 back.searchParams.set('evidenceUploaded','1');return NextResponse.redirect(back,303)
}
