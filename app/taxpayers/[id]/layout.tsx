import {redirect} from 'next/navigation'
import {currentWorkspace,taxpayerBelongsToWorkspace} from '@/lib/workspace'
import FraudContextCookie from '@/app/components/FraudContextCookie'

export const dynamic='force-dynamic'

export default async function TaxpayerWorkspaceLayout({children,params}:{children:React.ReactNode,params:Promise<{id:string}>}){
  const {id}=await params
  const workspace=await currentWorkspace()
  if(!workspace||!await taxpayerBelongsToWorkspace(id,workspace))redirect('/taxpayers')
  return <><FraudContextCookie/>{children}</>
}
