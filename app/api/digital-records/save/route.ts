import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isSameOriginRequest } from '@/lib/request-security'
import { listMtdIncomeSources, type MtdIncomeSourceRecord } from '@/lib/mtd-income-sources-server'

function taxYear(d:string){const x=new Date(`${d}T12:00:00Z`);const y=x.getUTCFullYear(),m=x.getUTCMonth()+1,day=x.getUTCDate();const s=m>4||(m===4&&day>=6)?y:y-1;return `${s}-${String(s+1).slice(-2)}`}

export async function POST(req:Request){
 if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
 const f=await req.formData()
 const taxpayerId=String(f.get('taxpayerId')||'')
 const businessId=String(f.get('businessId')||'')
 const requestedSourceType=String(f.get('sourceType')||'')
 const transactionDate=String(f.get('transactionDate')||'')
 const recordType=String(f.get('recordType')||'')
 const category=String(f.get('category')||'').trim()
 const description=String(f.get('description')||'').trim()
 const documentRef=String(f.get('documentReference')||'').trim()
 const amount=Number(f.get('amount'))
 const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/digital-records`,req.url)
 if(businessId)back.searchParams.set('businessId',businessId)
 if(requestedSourceType)back.searchParams.set('sourceType',requestedSourceType)
 if(!taxpayerId||!businessId||!/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)||!['income','expense'].includes(recordType)||!category||!Number.isFinite(amount)||amount<0){back.searchParams.set('error','Complete all required digital record fields with a valid amount.');return NextResponse.redirect(back,303)}
 const db=supabaseAdmin()
 let sources:MtdIncomeSourceRecord[]
 try{sources=await listMtdIncomeSources(db,taxpayerId)}catch(e:any){back.searchParams.set('error',e.message||'Could not validate the selected income source.');return NextResponse.redirect(back,303)}
 const source=sources.find(item=>item.businessId===businessId)
 if(!source){back.searchParams.set('error','The selected HMRC income source does not belong to this taxpayer.');return NextResponse.redirect(back,303)}
 if(requestedSourceType&&source.sourceType!==requestedSourceType){back.searchParams.set('error','The selected HMRC income source type does not match this record lane.');return NextResponse.redirect(back,303)}
 back.searchParams.set('sourceType',source.sourceType)
 const {error}=await db.from('mtd_digital_records').insert({taxpayer_id:taxpayerId,business_id:businessId,tax_year:taxYear(transactionDate),transaction_date:transactionDate,record_type:recordType,category,description:description||null,amount,source:'manual',document_url:documentRef||null})
 if(error){back.searchParams.set('error',error.message);return NextResponse.redirect(back,303)}
 back.searchParams.set('saved','1')
 return NextResponse.redirect(back,303)
}
