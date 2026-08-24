import { NextResponse } from 'next/server'
import type { MtdIncomeSourceType } from '@/lib/mtd-income-source'

function csvCell(value:string){const safe=/^[=+\-@]/.test(value)?"'"+value:value;return `"${safe.replace(/"/g,'""')}"`}

export async function GET(req:Request){
 const url=new URL(req.url)
 const requestedType=url.searchParams.get('sourceType')||url.searchParams.get('type')||'self-employment'
 const sourceType=(requestedType==='property'?'uk-property':requestedType) as MtdIncomeSourceType
 if(!['self-employment','uk-property','foreign-property'].includes(sourceType))return new NextResponse('Unsupported income source type',{status:404})
 const businessId=String(url.searchParams.get('businessId')||'HMRC_INCOME_SOURCE_ID').trim()
 const rows=sourceType==='foreign-property'?
  [[businessId,'2026-04-06','income','rents','1000.00','Example foreign property rent','INV-001'],[businessId,'2026-04-07','expense','propertyExpenses','45.50','Example foreign property expense','REC-001']]:sourceType==='uk-property'?
  [[businessId,'2026-04-06','income','rents','1000.00','Example UK property rent','INV-001'],[businessId,'2026-04-07','expense','premisesCosts','45.50','Example property running cost','REC-001']]:
  [[businessId,'2026-04-06','income','turnover','1000.00','Example sales invoice','INV-001'],[businessId,'2026-04-07','expense','travelCosts','45.50','Example business travel','REC-001']]
 const csv=['business_id,date,type,category,amount,description,document_reference',...rows.map(row=>row.map(value=>csvCell(String(value))).join(','))].join('\n')+'\n'
 const filename=sourceType==='foreign-property'?'mtd-foreign-property-records-template.csv':sourceType==='uk-property'?'mtd-uk-property-records-template.csv':'mtd-self-assessment-records-template.csv'
 return new NextResponse(csv,{status:200,headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${filename}"`,'Cache-Control':'no-store'}})
}
