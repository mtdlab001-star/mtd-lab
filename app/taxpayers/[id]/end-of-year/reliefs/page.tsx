import Link from 'next/link'
import TaxpayerSidebar from '@/app/components/TaxpayerSidebar'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic='force-dynamic'

function decode(value?:string){try{return value?JSON.parse(Buffer.from(value,'base64url').toString('utf8')):null}catch{return null}}
const labels:Record<string,string>={investment:'Investment Reliefs',other:'Other Reliefs',foreign:'Foreign Reliefs',pensions:'Pension Reliefs',charitable:'Charitable Giving'}

export default async function ReliefsPage({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<Record<string,string|undefined>>}){
 const {id}=await params;const qs=await searchParams;const db=supabaseAdmin()
 const {data:obligations}=await db.from('hmrc_obligations').select('period_start').eq('taxpayer_id',id).gte('period_start','2025-04-06')
 const years=Array.from(new Set((obligations||[]).map((o:any)=>{const d=String(o.period_start);const y=Number(d.slice(0,4));return `${y}-${String(y+1).slice(-2)}`}))).sort().reverse()
 const selected=qs.taxYear&&years.includes(qs.taxYear)?qs.taxYear:(years[0]||'2026-27')
 const type=labels[qs.type||'other']?String(qs.type):'other';const result=decode(qs.result)
 return <div className="shell"><TaxpayerSidebar taxpayerId={id} active="reliefs"/><main className="main">
  <div className="top"><div><h1 className="pageTitle">Reliefs and Deductions</h1><p className="muted">Review relief information held by HMRC before the end of year calculation and Final Declaration.</p></div><span className="badge">{selected}</span></div>
  {qs.error&&<div className="status statusError"><strong>HMRC needs attention.</strong><div>{qs.error}</div>{qs.correlationId&&<div className="muted">Correlation ID: {qs.correlationId}</div>}</div>}
  <section className="panel"><div className="sectionHead"><div><h2>HMRC relief schedules</h2><p className="muted">The Individuals Reliefs API separates reliefs into five schedules. Retrieve each category that applies to the taxpayer.</p></div><form method="get"><select className="selectField" name="taxYear" defaultValue={selected}>{years.length?years.map(y=><option key={y} value={y}>{y}</option>):<option value={selected}>{selected}</option>}</select><button className="btn btnSmall" type="submit">Change year</button></form></div>
   <div className="cards">{Object.entries(labels).map(([key,label])=><div className="card" key={key}><span className="eyebrow">{label}</span><p className="muted">Retrieve the current HMRC record for {selected}.</p><Link className="btn btnSmall" href={`/api/hmrc/reliefs/retrieve?taxpayerId=${encodeURIComponent(id)}&taxYear=${encodeURIComponent(selected)}&type=${encodeURIComponent(key)}`}>Retrieve from HMRC</Link></div>)}</div>
  </section>
  {qs.retrieved&&result&&<section className="panel" style={{marginTop:16}}><div className="sectionHead"><div><h2>{labels[type]}</h2><p className="muted">Retrieved directly from HMRC. Review these values before requesting the end of year calculation.</p></div>{qs.correlationId&&<span className="badge">Correlation {qs.correlationId}</span>}</div><details open><summary>HMRC response</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(result,null,2)}</pre></details></section>}
  <section className="panel" style={{marginTop:16}}><h2>Year end control</h2><p className="muted">This screen currently retrieves all five HMRC relief schedules. Create, amend and delete controls will be added per schedule only where HMRC validation rules can be enforced safely.</p><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link className="btn btnSmall" href={`/taxpayers/${id}/end-of-year?taxYear=${encodeURIComponent(selected)}`}>Back to End of Year</Link><Link className="btn btnSmall" href={`/taxpayers/${id}/calculations?taxYear=${encodeURIComponent(selected)}`}>HMRC Tax Calculation</Link></div></section>
 </main></div>
}
