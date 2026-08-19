import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

const purple='572060'

function styleSheet(ws:ExcelJS.Worksheet){
 ws.columns=[{width:48},{width:20},{width:24}]
 ws.getRow(1).font={bold:true,size:14,color:{argb:purple}}
 for(const row of [2,8,11]){
  const r=ws.getRow(row);r.font={bold:true,color:{argb:'FFFFFF'}};r.fill={type:'pattern',pattern:'solid',fgColor:{argb:purple}}
 }
 ws.eachRow(r=>{r.alignment={vertical:'middle'};r.height=22})
 ws.getColumn(2).numFmt='£#,##0.00'
 ws.getColumn(3).numFmt='£#,##0.00'
}

function selfEmployment(){
 const wb=new ExcelJS.Workbook();const ws=wb.addWorksheet('UK_Self-Employment')
 const rows:any[][]=[
  ['Income'],['Account Name','Total Amount (£)'],['Turnover',0],['Other Income ',0],['Tax taken off trading income',0],['Total Income ',{formula:'B3+B4-B5'}],['Expenses'],['Account Name','Total Amount (£)','Disallowable Amount (£)'],['Cost of goods sold',0,0],['CIS - Payments to subcontractors',0,0],['Wages, salaries and other staff costs',0,0],['Car, Van and travel expenses',0,0],['Rent, rates, power and insurance costs',0,0],['Repairs and maintenance of property equipment',0,0],['Phone, fax, stationery and other office costs',0,0],['Advertising costs',0,0],['Business entertainment costs',0,0],['Interest on bank and other loans',0,0],['Bank credit card and other financial charges',0,0],['Irrecoverable debts written off',0,0],['Accountancy, legal and other professional fees',0,0],['Depreciation and loss or profit on sale of assets',0,0],['Other business expenses',0,0],['Total Expenses ',{formula:'SUM(B9:B23)'},{formula:'SUM(C9:C23)'}],['Net Profit/Loss',{formula:'B6-B24+C24'}]
 ]
 rows.forEach(r=>ws.addRow(r));styleSheet(ws);return wb
}

function property(){
 const wb=new ExcelJS.Workbook();const ws=wb.addWorksheet('UK Property')
 const rows:any[][]=[
  ['Income'],['Account Name','Total Amount (£)'],['Rental Income',0],['Premiums of Lease Grant',0],['Reverse Premiums',0],['Other Property Income',0],['UK Tax Deducted',0],['Rent a Room Received',0],['Total Income ',{formula:'SUM(B3:B6,B8)-B7'}],['Expenses'],['Account Name','Total Amount (£)'],['Premises Running Costs',0],['Repairs and Maintenance',0],['Financial Costs',0],['Professional Fees',0],['Travel Costs',0],['Cost of Services',0],['Other Costs',0],['Rent a Room Relief',0],['Total Expenses ',{formula:'SUM(B12:B19)'}],['Net Profit/Loss',{formula:'B9-B20'}],['Residential Financial Cost',0],['Carry Forward Residential Finance Cost',0]
 ]
 rows.forEach(r=>ws.addRow(r));styleSheet(ws);return wb
}

export async function GET(_:Request,{params}:{params:Promise<{type:string}>}){
 const {type}=await params
 const propertyType=type==='property'
 const wb=propertyType?property():selfEmployment()
 const buffer=await wb.xlsx.writeBuffer()
 const filename=propertyType?'Template_UK-Property_Detailed_MTD_LAB.xlsx':'Sample_Self-Employment-Template_MTD_LAB.xlsx'
 return new NextResponse(Buffer.from(buffer),{headers:{'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','content-disposition':`attachment; filename="${filename}"`,'cache-control':'no-store'}})
}
