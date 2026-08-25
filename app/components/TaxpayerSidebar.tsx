'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type SourceType = 'self-employment' | 'uk-property' | 'foreign-property'
type Props = { taxpayerId: string; active?: string; sourceTypes?: SourceType[] }
type GroupKey = 'access' | 'hmrc' | 'mtd-income-tax' | 'income-sources' | 'mtd-filing'
type OpenGroups = Record<GroupKey, boolean>

const closedGroups: OpenGroups = {
  access: false,
  hmrc: false,
  'mtd-income-tax': false,
  'income-sources': false,
  'mtd-filing': false,
}

function activeGroupFor(active?: string): GroupKey | null {
  if (active === 'agents') return 'access'
  if (active === 'digital-records') return 'mtd-income-tax'
  if (['businesses', 'self-employment', 'property', 'foreign-property'].includes(active || '')) return 'income-sources'
  if (['submissions', 'quarterly', 'calculations', 'end-of-year', 'adjustments', 'tax-liability', 'reliefs', 'other-income', 'state-benefits', 'employment', 'history'].includes(active || '')) return 'mtd-filing'
  return null
}

export default function TaxpayerSidebar({ taxpayerId, active, sourceTypes }: Props) {
  const id = encodeURIComponent(taxpayerId)
  const visibleSourceTypes = sourceTypes || []
  const activeGroup = useMemo(() => activeGroupFor(active), [active])
  const storageKey = `mtd-lab:sidebar:${taxpayerId}`
  const [hydrated, setHydrated] = useState(false)
  const [openGroups, setOpenGroups] = useState<OpenGroups>(() => ({
    ...closedGroups,
    ...(activeGroup ? { [activeGroup]: true } : {}),
  }))

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || '{}')
      setOpenGroups({
        ...closedGroups,
        ...saved,
        ...(activeGroup ? { [activeGroup]: true } : {}),
      })
    } catch {
      setOpenGroups({
        ...closedGroups,
        ...(activeGroup ? { [activeGroup]: true } : {}),
      })
    }
    setHydrated(true)
  }, [storageKey, activeGroup])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(storageKey, JSON.stringify(openGroups))
  }, [hydrated, openGroups, storageKey])

  const toggle = (key: GroupKey) => setOpenGroups(current => ({ ...current, [key]: !current[key] }))
  const item = (key: string, label: string, href: string) => (
    <Link className={active === key ? 'navActive' : ''} href={href}>{label}</Link>
  )
  const group = (key: GroupKey, label: string, children: React.ReactNode) => (
    <section className="navGroup" key={key}>
      <button className="navGroupButton" type="button" aria-expanded={openGroups[key]} aria-controls={`sidebar-${key}`} onClick={() => toggle(key)}>
        <span>{label}</span><span className={`navChevron ${openGroups[key] ? 'navChevronOpen' : ''}`} aria-hidden="true">⌄</span>
      </button>
      {openGroups[key] && <div className="navGroupItems" id={`sidebar-${key}`}>{children}</div>}
    </section>
  )

  return <aside className="side">
    <div className="brand"><img className="brandLogo" src="/mtd-lab-logo-post-login.svg" alt="MTD Lab, Making Tax Digital for Income Tax"/></div>
    <nav className="nav" aria-label="Taxpayer navigation">
      {item('dashboard', 'Dashboard', '/')}
      {item('taxpayers', 'Taxpayers', '/taxpayers')}
      {item('overview', 'Taxpayer Overview', `/taxpayers/${id}`)}
      {group('access', 'Access', item('agents', 'Agent Authorisation', `/taxpayers/${id}/agents`))}
      {group('hmrc', 'HMRC', <>
        <Link href={`/taxpayers/${id}#connection`}>HMRC Authentication</Link>
        <Link href={`/taxpayers/${id}#sync`}>Synchronise HMRC</Link>
      </>)}
      {group('mtd-income-tax', 'MTD Income Tax', item('digital-records', 'Digital Records', `/taxpayers/${id}/digital-records`))}
      {group('income-sources', 'Income Sources', <>
        {item('businesses', 'All Businesses', `/taxpayers/${id}/businesses`)}
        {visibleSourceTypes.includes('self-employment') && item('self-employment', 'Self Employment', `/taxpayers/${id}/businesses?type=self-employment`)}
        {visibleSourceTypes.includes('uk-property') && item('property', 'UK Property', `/taxpayers/${id}/businesses?type=uk-property`)}
        {visibleSourceTypes.includes('foreign-property') && item('foreign-property', 'Foreign Property', `/taxpayers/${id}/businesses?type=foreign-property`)}
      </>)}
      {group('mtd-filing', 'MTD Filing', <>
        {item('submissions', 'Submission Centre', `/taxpayers/${id}/submissions`)}
        {item('quarterly', 'Quarterly Updates', `/taxpayers/${id}/quarterly`)}
        {item('calculations', 'HMRC Tax Calculation', `/taxpayers/${id}/calculations`)}
        {item('end-of-year', 'End of Year', `/taxpayers/${id}/end-of-year`)}
        {item('adjustments', 'Annual Adjustments & Losses', `/taxpayers/${id}/end-of-year/adjustments`)}
        {item('tax-liability', 'Tax Liability Adjustments', `/taxpayers/${id}/end-of-year/tax-liability`)}
        {item('reliefs', 'Reliefs & Deductions', `/taxpayers/${id}/end-of-year/reliefs`)}
        {item('other-income', 'Other SA Income', `/taxpayers/${id}/end-of-year/other-income`)}
        {item('state-benefits', 'State Benefits', `/taxpayers/${id}/end-of-year/state-benefits`)}
        {item('employment', 'Employment Income', `/taxpayers/${id}/end-of-year/employment`)}
        {item('history', 'Submission History', `/taxpayers/${id}/quarterly/history`)}
      </>)}
    </nav>
    <div className="operator">Operated by Glomaxel IT Service</div>
  </aside>
}
