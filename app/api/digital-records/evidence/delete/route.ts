import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isSameOriginRequest } from '@/lib/request-security'
import { recordDigitalRecordAudit } from '@/lib/digital-record-audit'

export async function POST(req:Request){
 if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
 const form=await req.formData();const taxpayerId=String(form.get('taxpayerId')||'');const recordId=String(form.get('recordId')||'');const businessId=String(form.get('businessId')||'');const sourceType=String(form.get('sourceType')||'');const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/digital-records`,req.url)
 if(businessId)back.searchParams.set('businessId',businessId);if(sourceType)back.searchParams.set('sourceType',sourceType)
 const db=supabaseAdmin();const {data:row}=await db.from('mtd_digital_records').select('id,business_id,tax_year,document_url,document_name').eq('id',recordId).eq('taxpayer_id',taxpayerId).maybeSingle()
 if(!row?.document_url){back.searchParams.set('error','Supporting document was not found.');return NextResponse.redirect(back,303)}
 const {error}=await db.storage.from('mtd-evidence').remove([row.document_url]);if(error){back.searchParams.set('error',error.message);return NextResponse.redirect(back,303)}
 await db.from('mtd_digital_records').update({document_url:null,document_name:null,document_mime_type:null,document_size:null,document_uploaded_at:null}).eq('id',recordId).eq('taxpayer_id',taxpayerId)
 await recordDigitalRecordAudit(db,{taxpayerId,businessId:row.business_id,taxYear:row.tax_year,eventType:'digital_record_evidence_deleted',summary:{recordId,fileName:row.document_name}})
 back.searchParams.set('evidenceDeleted','1');return NextResponse.redirect(back,303)
}
