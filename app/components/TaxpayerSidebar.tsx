import Link from 'next/link'

type Props={taxpayerId:string;active?:string}

export default function TaxpayerSidebar({taxpayerId,active}:Props){
 const id=encodeURIComponent(taxpayerId)
 const item=(key:string,label:string,href:string,indent=false)=><Link className={`${active===key?'navActive ':''}${indent?'navIndent':''}`} href={href}>{label}</Link>
 return <aside className="side">
  <div className="brand">MTD Lab</div>
  <div className="nav">
   {item('dashboard','Dashboard','/')}
   {item('taxpayers','Taxpayers','/taxpayers')}
   {item('overview','Taxpayer Overview',`/taxpayers/${id}`)}
   <div className="navGroupLabel">HMRC</div>
   <Link className="navIndent" href={`/taxpayers/${id}#connection`}>HMRC Authentication</Link>
   <Link className="navIndent" href={`/taxpayers/${id}#sync`}>Synchronise HMRC</Link>
   <div className="navGroupLabel">Income Sources</div>
   {item('businesses','All Businesses',`/taxpayers/${id}/businesses`,true)}
   {item('self-employment','Self Employment',`/taxpayers/${id}/businesses?type=self-employment`,true)}
   {item('property','UK Property',`/taxpayers/${id}/businesses?type=property`,true)}
   <div className="navGroupLabel">MTD Filing</div>
   {item('quarterly','Quarterly Updates',`/taxpayers/${id}/quarterly`,true)}
   {item('history','Submission History',`/taxpayers/${id}/quarterly/history`,true)}
  </div>
  <div className="operator">Operated by Glomaxel IT Service</div>
 </aside>
}
