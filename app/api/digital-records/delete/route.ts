import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isSameOriginRequest } from '@/lib/request-security'

export async function POST(req:Request){
 if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
 const form=await req.formData();const taxpayerId=String(form.get('taxpayerId')||'');const recordId=String(form.get('recordId')||'');const businessId=String(form.get('businessId')||'');const sourceType=String(form.get('sourceType')||'');
 const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/digital-records`,req.url)
 if(businessId)back.searchParams.set('businessId',businessId)
 if(sourceType)back.searchParams.set('sourceType',sourceType)
 if(!taxpayerId||!recordId){back.searchParams.set('error','Digital record is missing.');return NextResponse.redirect(back,303)}
 const db=supabaseAdmin();const {data:row}=await db.from('mtd_digital_records').select('id,taxpayer_id').eq('id',recordId).eq('taxpayer_id',taxpayerId).maybeSingle()
 if(!row){back.searchParams.set('error','Digital record was not found.');return NextResponse.redirect(back,303)}
 const {error}=await db.from('mtd_digital_records').delete().eq('id',recordId).eq('taxpayer_id',taxpayerId)
 if(error){back.searchParams.set('error',error.message);return NextResponse.redirect(back,303)}
 back.searchParams.set('deleted','1');return NextResponse.redirect(back,303)
}
