'use client'

import {useMemo,useState} from 'react'
import Image from 'next/image'
import s from './help.module.css'

type Guide={
  id:string
  category:string
  title:string
  summary:string
  steps:string[]
  note?:string
}

const guides:Guide[]=[
  {
    id:'sign-in',
    category:'Getting started',
    title:'Sign in to MTD Lab',
    summary:'Access your secure MTD Income Tax workspace.',
    steps:[
      'Enter the MTD Lab username and password supplied by your administrator.',
      'Use the eye button to show or hide the password before signing in.',
      'If access is refused, check the spelling and letter case, then contact support. MTD Lab cannot display a saved password.',
    ],
  },
  {
    id:'taxpayer',
    category:'Getting started',
    title:'Add an HMRC sandbox taxpayer',
    summary:'Create a taxpayer workspace using HMRC test details.',
    steps:[
      'Create an individual test user in the HMRC Developer Hub.',
      'In MTD Lab, open Taxpayers, then add the NINO and MTD Income Tax ID.',
      'Keep the Government Gateway test password outside MTD Lab. It is entered only on the HMRC authorisation page.',
    ],
  },
  {
    id:'connect-hmrc',
    category:'HMRC connection',
    title:'Connect or reconnect HMRC',
    summary:'Authorise MTD Lab and refresh the taxpayer record.',
    steps:[
      'Open the taxpayer overview and select Connect to HMRC or Reconnect to HMRC.',
      'Complete consent on the HMRC page using the correct sandbox test user.',
      'Return to MTD Lab and select Synchronise now to retrieve businesses and obligations.',
    ],
    note:'Government Gateway credentials stay with HMRC and are not stored by MTD Lab.',
  },
  {
    id:'api-subscription',
    category:'HMRC connection',
    title:'Fix an API subscription warning',
    summary:'Resolve “The application is not subscribed to the API”.',
    steps:[
      'Open the application in the HMRC Developer Hub.',
      'Under API subscriptions, add the API and version named in the warning.',
      'Reconnect HMRC if the authorised access token was created before the subscription was added, then retry the request.',
    ],
  },
  {
    id:'digital-records',
    category:'Digital records',
    title:'Record income and expenses',
    summary:'Maintain source specific digital records before submission.',
    steps:[
      'Choose the correct income source, such as Self Employment, UK Property or Foreign Property.',
      'Enter transactions manually or download and complete the matching spreadsheet template.',
      'Import the completed file, review rejected or duplicated rows, and confirm the totals before preparing an update.',
    ],
  },
  {
    id:'evidence',
    category:'Digital records',
    title:'Keep submission evidence',
    summary:'Preserve the figures and HMRC result for audit support.',
    steps:[
      'Upload supporting evidence only to the matching taxpayer and income source.',
      'After submission, open the history page to review the stored totals and HMRC status.',
      'Download the submission evidence record when a permanent working paper is needed.',
    ],
  },
  {
    id:'quarterly',
    category:'Quarterly updates',
    title:'Submit a quarterly update',
    summary:'Prepare and send cumulative figures for an eligible period.',
    steps:[
      'Synchronise HMRC and open Quarterly Obligations.',
      'Open a future quarter to prepare and review cumulative figures in advance. Preparation mode does not send anything to HMRC.',
      'Wait until the displayed availability date before submitting. MTD Lab checks the period date again on the server.',
      'For an eligible period, review cumulative income and expenses, check readiness, then submit.',
      'After HMRC accepts the update, synchronise again to refresh the obligation status.',
    ],
  },
  {
    id:'acting-capacity',
    category:'Quarterly updates',
    title:'Choose and save the acting capacity',
    summary:'Prepare a direct or delegated quarterly filing safely.',
    steps:[
      'On the quarterly review page, choose Taxpayer connection for a direct filing.',
      'Choose a connected authorised agent only when that agent is acting for the submission and has quarterly permission.',
      'Wait for Selection saved before leaving the page.',
      'When the page is reopened, confirm the saved acting capacity before submission.',
    ],
  },
  {
    id:'quarterly-status',
    category:'Quarterly updates',
    title:'Understand obligation statuses',
    summary:'Read the status shown beside each quarterly period.',
    steps:[
      'Fulfilled means HMRC reports the obligation as completed.',
      'Submitted means MTD Lab has an accepted submission while HMRC may still show the obligation as open.',
      'Not due yet means the period is not available for submission.',
      'Open means the period is eligible and still needs an update.',
    ],
  },
  {
    id:'year-end',
    category:'Year end',
    title:'Complete the year end process',
    summary:'Review annual information before the Final Declaration.',
    steps:[
      'Review business adjustments, losses, employment, state benefits, other income, reliefs and tax liability adjustments.',
      'Confirm all quarterly obligations are complete and retrieve the HMRC tax calculation.',
      'Check the calculation carefully, then submit the Final Declaration only after the tax year has ended and every readiness check passes.',
    ],
  },
  {
    id:'agent',
    category:'Agents',
    title:'File through an Agent Services Account',
    summary:'Use a connected agent relationship without asking the client to reconnect HMRC for every filing.',
    steps:[
      'Open the firm Agents page to review active agents, or open Agent Authorisation inside a taxpayer workspace.',
      'Select an existing firm agent where possible, then grant only the permissions required for that taxpayer.',
      'Connect the agent to its HMRC Agent Services Account and confirm the HMRC client relationship.',
      'Select the agent acting capacity on the review page and wait for Selection saved.',
    ],
  },
  {
    id:'release-readiness',
    category:'Release readiness',
    title:'Complete Stage 2 release readiness',
    summary:'Collect controlled sandbox evidence while production remains locked.',
    steps:[
      'Open Release readiness from the main navigation and review every pending control.',
      'Obtain accepted sandbox evidence for each applicable income source and every HMRC business ID.',
      'Complete at least one accepted direct quarterly filing and the required delegated agent filing evidence.',
      'Synchronise HMRC, confirm fulfilled obligations, then download the evidence pack when it becomes available.',
      'Keep production submissions locked until every readiness control passes and formal approval is complete.',
    ],
  },
  {
    id:'archive-capacity',
    category:'Workspace management',
    title:'Manage taxpayers and client capacity',
    summary:'Archive safely, restore clients and understand account capacity.',
    steps:[
      'Use Archive to remove a taxpayer from active lists without deleting HMRC connections, obligations, submissions or audit history.',
      'Open View archived clients to restore an archived workspace.',
      'Use Remove only when permanent deletion is intended and confirm the exact taxpayer name.',
      'Open Plans and Billing to review used spaces, remaining capacity, annual bundles and billing history.',
    ],
  },
  {
    id:'no-record',
    category:'Troubleshooting',
    title:'No HMRC record was found',
    summary:'Understand a valid empty response from HMRC.',
    steps:[
      'Check that the selected tax year and taxpayer identifiers are correct.',
      'Synchronise HMRC and retry the retrieval.',
      'If HMRC still returns no record, create or amend the information only when the taxpayer genuinely has something to report.',
    ],
    note:'A “no record found” response is not always an application fault. It can mean HMRC has no information in that category for the selected year.',
  },
  {
    id:'support',
    category:'Troubleshooting',
    title:'Report a problem',
    summary:'Send enough information for a safe and useful investigation.',
    steps:[
      'Take a screenshot that does not expose passwords, access tokens or client secrets.',
      'Include the page name, selected tax year, time of the problem and the correlation ID if one is displayed.',
      'Email the details to support@mtdlab.co.uk. Never send Government Gateway credentials.',
    ],
  },
]

const categories=['All guides',...Array.from(new Set(guides.map(guide=>guide.category)))]

export default function HelpCentre(){
  const [query,setQuery]=useState('')
  const [category,setCategory]=useState('All guides')
  const filtered=useMemo(()=>{
    const needle=query.trim().toLowerCase()
    return guides.filter(guide=>{
      const inCategory=category==='All guides'||guide.category===category
      const searchable=[guide.title,guide.summary,guide.category,...guide.steps,guide.note||''].join(' ').toLowerCase()
      return inCategory&&(!needle||searchable.includes(needle))
    })
  },[query,category])

  return <main className={s.page}>
    <header className={s.header}>
      <a className={s.brand} href="/login" aria-label="MTD Lab sign in">
        <Image src="/mtd-lab-logo-exact.webp" alt="" width={36} height={36}/>
        <span>MTD Lab</span><b>Help Centre</b>
      </a>
      <nav aria-label="Help Centre actions">
        <a href="mailto:support@mtdlab.co.uk">Contact support</a>
        <a className={s.signIn} href="/login">Sign in</a>
      </nav>
    </header>

    <section className={s.hero}>
      <span className={s.kicker}>MTD LAB SUPPORT</span>
      <h1>How can we help?</h1>
      <p>Find practical guidance for HMRC connections, digital records, quarterly updates and year end filing.</p>
      <label className={s.search}>
        <span aria-hidden="true">⌕</span>
        <span className={s.srOnly}>Search the Help Centre</span>
        <input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search guides and troubleshooting"/>
        {query&&<button type="button" onClick={()=>setQuery('')} aria-label="Clear search">Clear</button>}
      </label>
    </section>

    <div className={s.layout}>
      <aside className={s.sidebar}>
        <p>Browse topics</p>
        {categories.map(item=><button key={item} type="button" className={item===category?s.active:''} onClick={()=>setCategory(item)}>{item}<span>{item==='All guides'?guides.length:guides.filter(guide=>guide.category===item).length}</span></button>)}
        <div className={s.supportCard}>
          <strong>Still need help?</strong>
          <p>Send the page, time and correlation ID. Do not send passwords.</p>
          <a href="mailto:support@mtdlab.co.uk?subject=MTD%20Lab%20support%20request">Email support</a>
        </div>
      </aside>

      <section className={s.results} aria-live="polite">
        <div className={s.resultHead}>
          <div><span>{category}</span><h2>{query?`Results for “${query}”`:'Guides and answers'}</h2></div>
          <p>{filtered.length} {filtered.length===1?'guide':'guides'}</p>
        </div>
        <div className={s.guides}>
          {filtered.map(guide=><article id={guide.id} className={s.guide} key={guide.id}>
            <span>{guide.category}</span>
            <h3>{guide.title}</h3>
            <p>{guide.summary}</p>
            <details>
              <summary>Read guide</summary>
              <ol>{guide.steps.map(step=><li key={step}>{step}</li>)}</ol>
              {guide.note&&<div className={s.note}><strong>Important</strong><p>{guide.note}</p></div>}
            </details>
          </article>)}
          {!filtered.length&&<div className={s.empty}><strong>No matching guides</strong><p>Try a shorter search or select All guides.</p><button type="button" onClick={()=>{setQuery('');setCategory('All guides')}}>Reset search</button></div>}
        </div>
      </section>
    </div>

    <footer className={s.footer}>
      <span>MTD Lab Help Centre</span>
      <p>Making Tax Digital for Income Tax guidance for the MTD Lab workspace.</p>
      <a href="/login">Return to sign in</a>
    </footer>
  </main>
}
