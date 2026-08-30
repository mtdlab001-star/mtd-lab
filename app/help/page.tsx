import type {Metadata} from 'next'
import HelpCentre from './HelpCentre'

export const metadata:Metadata={
  title:'Help Centre | MTD Lab',
  description:'Guides and troubleshooting for MTD Lab and HMRC Making Tax Digital for Income Tax.',
}

export default function HelpPage(){
  return <HelpCentre/>
}
