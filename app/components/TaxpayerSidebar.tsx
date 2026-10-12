'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type SourceType = 'self-employment' | 'uk-property' | 'foreign-property'
type Props = { taxpayerId: string; active?: string; sourceTypes?: SourceType[] }
type GroupKey = 'start' | 'records' | 'filing' | 'more'
type OpenGroups = Record<GroupKey, boolean>

const closedGroups: OpenGroups = {
  start: false,
  records: false,
  filing: false,
  more: false,
}

function activeGroupFor(active?: string): GroupKey | null {
  if (active === 'agents') return 'start'
  if (['digital-records', 'businesses', 'self-employment', 'property', 'foreign-property'].includes(active || '')) return 'records'
  if (['submissions', 'quarterly', 'calculations', 'end-of-year', 'history'].includes(active || '')) return 'filing'
  if (['adjustments', 'tax-liability', 'reliefs', 'other-income', 'state-benefits', 'employment'].includes(active || '')) return 'more'
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
      {item('dashboard', 'Home', '/')}
      {item('taxpayers', 'Clients', '/taxpayers')}
      {item('overview', 'Client summary', `/taxpayers/${id}`)}
      {group('start', 'Get started', <>
        <Link href={`/taxpayers/${id}#connection`}>Connect to HMRC</Link>
        <Link href={`/taxpayers/${id}#sync`}>Refresh HMRC details</Link>
        {item('agents', 'Agent access', `/taxpayers/${id}/agents`)}
      </>)}
      {group('records', 'Records', <>
        {item('digital-records', 'Income and expenses', `/taxpayers/${id}/digital-records`)}
        {item('businesses', 'Income sources', `/taxpayers/${id}/businesses`)}
        {visibleSourceTypes.includes('self-employment') && item('self-employment', 'Self Employment', `/taxpayers/${id}/businesses?type=self-employment`)}
        {visibleSourceTypes.includes('uk-property') && item('property', 'UK Property', `/taxpayers/${id}/businesses?type=uk-property`)}
        {visibleSourceTypes.includes('foreign-property') && item('foreign-property', 'Foreign Property', `/taxpayers/${id}/businesses?type=foreign-property`)}
      </>)}
      {group('filing', 'Submit to HMRC', <>
        {item('submissions', 'Prepare an update', `/taxpayers/${id}/submissions`)}
        {item('quarterly', 'Quarterly Updates', `/taxpayers/${id}/quarterly`)}
        {item('end-of-year', 'Year end', `/taxpayers/${id}/end-of-year`)}
        {item('calculations', 'Tax calculation', `/taxpayers/${id}/calculations`)}
        {item('history', 'Previous submissions', `/taxpayers/${id}/quarterly/history`)}
      </>)}
      {group('more', 'More tax details', <>
        {item('adjustments', 'Adjustments and losses', `/taxpayers/${id}/end-of-year/adjustments`)}
        {item('tax-liability', 'Tax Liability Adjustments', `/taxpayers/${id}/end-of-year/tax-liability`)}
        {item('reliefs', 'Reliefs and deductions', `/taxpayers/${id}/end-of-year/reliefs`)}
        {item('other-income', 'Other income', `/taxpayers/${id}/end-of-year/other-income`)}
        {item('state-benefits', 'State Benefits', `/taxpayers/${id}/end-of-year/state-benefits`)}
        {item('employment', 'Employment Income', `/taxpayers/${id}/end-of-year/employment`)}
      </>)}
    </nav>
    <div className="operator">Operated by Glomaxel IT Service</div>
  </aside>
}
