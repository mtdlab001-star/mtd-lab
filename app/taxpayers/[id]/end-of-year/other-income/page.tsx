import Link from 'next/link'
import TaxpayerSidebar from '@/app/components/TaxpayerSidebar'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic='force-dynamic'
function decode(value?:string){try{return value?JSON.parse(Buffer.from(value,'base64url').toString('utf8')):null}catch{return null}}

export default async function OtherIncomePage({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<Record<string,string|undefined>>}){
 const {id}=await params;const qs=await searchParams;const db=supabaseAdmin();const {data:obligations}=await db.from('hmrc_obligations').select('period_start').eq('taxpayer_id',id).gte('period_start','2025-04-06')
 const years=Array.from(new Set((obligations||[]).map((o:any)=>{const d=String(o.period_start);const y=Number(d.slice(0,4));return `${y}-${String(y+1).slice(-2)}`}))).sort().reverse();const selected=qs.taxYear&&years.includes(qs.taxYear)?qs.taxYear:(years[0]||'2026-27');const result=decode(qs.result)
 return <div className="shell"><TaxpayerSidebar taxpayerId={id} active="other-income"/><main className="main">
  <div className="top"><div><h1 className="pageTitle">Other Self Assessment Income</h1><p className="muted">Review other income held by HMRC before the end of year calculation and declaration.</p></div><span className="badge">{selected}</span></div>
  {qs.error&&<div className="status statusError"><strong>HMRC needs attention.</strong><div>{qs.error}</div>{qs.correlationId&&<div className="muted">Correlation ID: {qs.correlationId}</div>}</div>}
  <section className="panel"><div className="sectionHead"><div><h2>HMRC other income</h2><p className="muted">Retrieve the taxpayer's current Other Income record from HMRC for the selected tax year.</p></div><form method="get"><select className="selectField" name="taxYear" defaultValue={selected}>{years.length?years.map(y=><option key={y} value={y}>{y}</option>):<option value={selected}>{selected}</option>}</select><button className="btn btnSmall" type="submit">Change year</button></form></div><Link className="btn" href={`/api/hmrc/other-income/retrieve?taxpayerId=${encodeURIComponent(id)}&taxYear=${encodeURIComponent(selected)}`}>Retrieve other income from HMRC</Link></section>
  {qs.retrieved&&result&&<section className="panel" style={{marginTop:16}}><div className="sectionHead"><div><h2>HMRC record</h2><p className="muted">Retrieved directly from HMRC.</p></div>{qs.correlationId&&<span className="badge">Correlation {qs.correlationId}</span>}</div><details open><summary>View other income response</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(result,null,2)}</pre></details></section>}
  <section className="panel" style={{marginTop:16}}><h2>Year end control</h2><p className="muted">The HMRC Other Income API also supports create, amend and delete. MTD Lab will only expose those write actions after the category fields and tax year validation rules are presented clearly to the user.</p><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link className="btn btnSmall" href={`/taxpayers/${id}/end-of-year?taxYear=${encodeURIComponent(selected)}`}>Back to End of Year</Link><Link className="btn btnSmall" href={`/taxpayers/${id}/end-of-year/reliefs?taxYear=${encodeURIComponent(selected)}`}>Reliefs and Deductions</Link></div></section>
 </main></div>
}
