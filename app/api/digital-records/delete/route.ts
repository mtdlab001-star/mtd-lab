import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isSameOriginRequest } from '@/lib/request-security'
import { recordDigitalRecordAudit } from '@/lib/digital-record-audit'
import { currentWorkspace, taxpayerBelongsToWorkspace } from '@/lib/workspace'

export async function POST(req:Request){
 if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
 const workspace=await currentWorkspace()
 if(!workspace)return new NextResponse('Accounting workspace access is not available',{status:401})
 const form=await req.formData();const taxpayerId=String(form.get('taxpayerId')||'');const recordId=String(form.get('recordId')||'');const businessId=String(form.get('businessId')||'');const sourceType=String(form.get('sourceType')||'');
 const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/digital-records`,req.url)
 if(businessId)back.searchParams.set('businessId',businessId)
 if(sourceType)back.searchParams.set('sourceType',sourceType)
 if(!taxpayerId||!recordId||!await taxpayerBelongsToWorkspace(taxpayerId,workspace)){back.searchParams.set('error','Digital record was not found.');return NextResponse.redirect(back,303)}
 const db=supabaseAdmin();const {data:row}=await db.from('mtd_digital_records').select('id,taxpayer_id,business_id,tax_year,record_type,category,amount,document_url').eq('firm_id',workspace.firmId).eq('id',recordId).eq('taxpayer_id',taxpayerId).maybeSingle()
 if(!row){back.searchParams.set('error','Digital record was not found.');return NextResponse.redirect(back,303)}
 const {error}=await db.from('mtd_digital_records').delete().eq('firm_id',workspace.firmId).eq('id',recordId).eq('taxpayer_id',taxpayerId)
 if(error){back.searchParams.set('error',error.message);return NextResponse.redirect(back,303)}
 if(row.document_url)await db.storage.from('mtd-evidence').remove([row.document_url])
 await recordDigitalRecordAudit(db,{taxpayerId,businessId:row.business_id,taxYear:row.tax_year,eventType:'digital_record_deleted',summary:{recordId:row.id,recordType:row.record_type,category:row.category,amount:Number(row.amount||0),evidenceRemoved:Boolean(row.document_url)}})
 back.searchParams.set('deleted','1');return NextResponse.redirect(back,303)
}
