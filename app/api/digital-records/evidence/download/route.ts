import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

function dispositionName(value:string){return value.replace(/[\r\n"]/g,'_').slice(0,180)||'evidence'}
export async function GET(req:Request){
 const url=new URL(req.url);const taxpayerId=url.searchParams.get('taxpayerId')||'';const recordId=url.searchParams.get('recordId')||''
 if(!taxpayerId||!recordId)return new NextResponse('Evidence reference is missing.',{status:400})
 const db=supabaseAdmin();const {data:row}=await db.from('mtd_digital_records').select('document_url,document_name,document_mime_type').eq('id',recordId).eq('taxpayer_id',taxpayerId).maybeSingle()
 if(!row?.document_url)return new NextResponse('Supporting document was not found.',{status:404})
 const {data,error}=await db.storage.from('mtd-evidence').download(row.document_url)
 if(error||!data)return new NextResponse('Supporting document could not be downloaded.',{status:404})
 return new NextResponse(data,{headers:{'Content-Type':row.document_mime_type||data.type||'application/octet-stream','Content-Disposition':`attachment; filename="${dispositionName(row.document_name||'evidence')}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
}
