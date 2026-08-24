export type DigitalRecordSource={businessId:string;sourceType:string}
export type DigitalRecordInsert={taxpayer_id:string;business_id:string;tax_year:string;transaction_date:string;record_type:'income'|'expense';category:string;description:string|null;amount:number;source:'csv';source_reference:string|null}
export type CsvIssue={row:number;message:string}

export function taxYearForDate(value:string){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if(!match)return null
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3])
  const date=new Date(Date.UTC(year,month-1,day))
  if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return null
  const start=month>4||(month===4&&day>=6)?year:year-1
  return `${start}-${String(start+1).slice(-2)}`
}

export function parseCsv(text:string){
  const rows:string[][]=[];let row:string[]=[],cell='',quoted=false
  for(let i=0;i<text.length;i++){
    const c=text[i]
    if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
    else if(c===','&&!quoted){row.push(cell);cell=''}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);cell='';if(row.some(v=>v.trim()!==''))rows.push(row);row=[]}
    else cell+=c
  }
  row.push(cell);if(row.some(v=>v.trim()!==''))rows.push(row)
  return {rows,unterminatedQuote:quoted}
}

export function validateCsvRows(args:{text:string;taxpayerId:string;selectedBusinessId:string;requestedSourceType:string;sources:DigitalRecordSource[]}){
  const parsed=parseCsv(args.text);const issues:CsvIssue[]=[]
  if(parsed.unterminatedQuote)issues.push({row:1,message:'The CSV contains an unterminated quoted value.'})
  if(parsed.rows.length<2)return {inserts:[] as DigitalRecordInsert[],issues:[...issues,{row:1,message:'Add a header row and at least one digital record.'}],signatures:[] as string[],rowNumbers:[] as number[]}
  const header=parsed.rows[0].map(v=>v.trim().toLowerCase())
  const required=['business_id','date','type','category','amount']
  for(const name of required)if(!header.includes(name))issues.push({row:1,message:`Missing required column “${name}”.`})
  if(issues.length)return {inserts:[] as DigitalRecordInsert[],issues,signatures:[] as string[],rowNumbers:[] as number[]}
  const idx=(name:string)=>header.indexOf(name);const allowed=new Map(args.sources.map(source=>[source.businessId,source]));const pending=new Set<string>();const inserts:DigitalRecordInsert[]=[];const signatures:string[]=[];const rowNumbers:number[]=[]
  for(let index=1;index<parsed.rows.length;index++){
    const line=parsed.rows[index],row=index+1;const businessId=String(line[idx('business_id')]||'').trim();const transactionDate=String(line[idx('date')]||'').trim();const recordType=String(line[idx('type')]||'').trim().toLowerCase();const category=String(line[idx('category')]||'').trim();const amountText=String(line[idx('amount')]||'').replace(/£|,/g,'').trim();const amount=Number(amountText);const description=idx('description')>=0?String(line[idx('description')]||'').trim():'';const documentRef=idx('document_reference')>=0?String(line[idx('document_reference')]||'').trim():'';const source=allowed.get(businessId);const year=taxYearForDate(transactionDate)
    const rowIssues:string[]=[]
    if(!businessId)rowIssues.push('business_id is empty')
    else if(!source)rowIssues.push('business_id is not an HMRC income source for this taxpayer')
    else if(args.selectedBusinessId&&businessId!==args.selectedBusinessId)rowIssues.push('business_id does not match the selected income source')
    else if(args.requestedSourceType&&source.sourceType!==args.requestedSourceType)rowIssues.push('business_id belongs to a different income-source lane')
    if(!year)rowIssues.push('date must be a real date in YYYY-MM-DD format')
    if(!['income','expense'].includes(recordType))rowIssues.push('type must be income or expense')
    if(!category)rowIssues.push('category is empty')
    if(!amountText||!Number.isFinite(amount)||amount<0)rowIssues.push('amount must be zero or a positive number')
    const signature=[businessId,transactionDate,recordType,category,amount].join('|')
    if(!rowIssues.length&&pending.has(signature))rowIssues.push('duplicate of an earlier row in this CSV')
    if(rowIssues.length){issues.push({row,message:rowIssues.join('; ')});continue}
    pending.add(signature);signatures.push(signature);rowNumbers.push(row)
    inserts.push({taxpayer_id:args.taxpayerId,business_id:businessId,tax_year:year!,transaction_date:transactionDate,record_type:recordType as 'income'|'expense',category,description:description||null,amount,source:'csv',source_reference:documentRef||null})
  }
  return {inserts,issues,signatures,rowNumbers}
}
