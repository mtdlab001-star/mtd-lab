export type HelpChatMessage={
  role:'user'|'assistant'
  text:string
}

type HelpTopic={
  keywords:string[]
  answer:string
}

const topics:HelpTopic[]=[
  {
    keywords:['sign in','signin','login','password','reveal','eye'],
    answer:'On the sign in page, enter the MTD Lab username and password supplied by your administrator. Select the eye button inside the password box to show or hide what you typed. MTD Lab cannot reveal a saved password. If access is still refused, check letter case and contact support.',
  },
  {
    keywords:['connect','reconnect','authorise','authorize','oauth','government gateway'],
    answer:'Open the taxpayer overview and select Connect to HMRC or Reconnect to HMRC. Complete consent on the HMRC page with the correct sandbox test user, return to MTD Lab, then select Synchronise now. Government Gateway credentials stay with HMRC and must never be sent to support.',
  },
  {
    keywords:['subscription','subscribed','api warning','api error'],
    answer:'Open your application in the HMRC Developer Hub, add the API and version named in the warning, then reconnect HMRC and retry. A token created before the API was added may need fresh authorisation.',
  },
  {
    keywords:['taxpayer','nino','mtd income tax id','test user'],
    answer:'For sandbox testing, open Sandbox setup, create an individual test user with HMRC, then add the generated NINO and MTD Income Tax ID to MTD Lab. The Government Gateway test password is used only on HMRC pages and must not be stored in MTD Lab.',
  },
  {
    keywords:['dashboard','overview','due','recent submission','current date'],
    answer:'The Dashboard summarises taxpayer workspaces, HMRC income sources, due obligations and accepted quarterly submissions. Select Taxpayers to open a client. Administrators can also open Agents, Sandbox setup, Plans and Billing, or Release readiness from the main navigation.',
  },
  {
    keywords:['digital record','income','expense','spreadsheet','template','import','transaction'],
    answer:'Open Digital Records for the correct source, such as Self Employment, UK Property or Foreign Property. Add transactions manually or download the matching spreadsheet template, import it, review rejected or duplicate rows, then confirm the totals before preparing an update.',
  },
  {
    keywords:['quarter','quarterly','obligation','submit update','not due','fulfilled','submitted'],
    answer:'Synchronise HMRC and open Quarterly Obligations. You may prepare and review cumulative figures for a future quarter, but an update can be submitted only after its period has ended. After HMRC accepts an eligible update, synchronise again so the obligation can change to Fulfilled.',
  },
  {
    keywords:['preparation mode','prepare future','future quarter','availability date','period ended','locked'],
    answer:'Preparation mode lets you enter, import and review cumulative figures before the quarter becomes eligible. It does not send anything to HMRC. The review page displays the exact date submission becomes available, and the server checks eligibility again before any transmission.',
  },
  {
    keywords:['acting capacity','taxpayer connection','agent connection','selection saved','parker'],
    answer:'On the review page, choose Taxpayer connection for a direct filing or choose a connected authorised agent for delegated filing. Wait for Selection saved before leaving. MTD Lab preserves that choice with the draft and validates the agent permission and ASA connection again before submission.',
  },
  {
    keywords:['year end','final declaration','calculation','tax calculation','annual adjustment','loss','relief'],
    answer:'At year end, review business adjustments, losses, employment, state benefits, other income, reliefs and tax liability adjustments. Confirm all quarterly obligations are complete, retrieve and check the HMRC calculation, then send the Final Declaration only after the tax year has ended and every readiness check passes.',
  },
  {
    keywords:['agent','asa','agent services account','client authorisation'],
    answer:'Open Agents to review the firm register. For a taxpayer, open Agent Authorisation, select an existing firm agent or create one, grant only the required permissions, connect the ASA, then check or create the HMRC client relationship. All required controls must be valid before delegated filing.',
  },
  {
    keywords:['release readiness','release ready','10 of 14','validation incomplete','evidence pack','production lock'],
    answer:'Release readiness records the sandbox evidence required before production capability can be considered. Pending quarterly controls require accepted sandbox submissions for every applicable lane and business ID, including direct and delegated routes. Keep production submissions locked until every control passes and approval is complete.',
  },
  {
    keywords:['archive','restore','remove taxpayer','delete taxpayer','client capacity','billing','bundle'],
    answer:'Use Archive to hide a taxpayer without deleting its HMRC connections, obligations, submissions or audit history. Restore archived clients from View archived clients. Use Remove only for intentional permanent deletion. Plans and Billing shows the firm client allowance and available annual bundles, but payments remain unavailable during pre launch.',
  },
  {
    keywords:['history','submission history','evidence pack','download evidence','audit'],
    answer:'Open View submission history to inspect stored quarterly attempts and accepted results. Once accepted taxpayer evidence exists, Release readiness provides a downloadable evidence pack containing the recorded submission and calculation information for review.',
  },
  {
    keywords:['no record','not found','empty response'],
    answer:'Check the taxpayer identifiers and selected tax year, synchronise HMRC, then retry. A no record response can be valid and may simply mean HMRC has no information in that category for the selected year.',
  },
  {
    keywords:['error','problem','support','correlation','failed','not working'],
    answer:'Take a screenshot that does not expose passwords, access tokens or client secrets. Record the page, selected tax year, time and correlation ID, then email support@mtdlab.co.uk. Never send Government Gateway credentials.',
  },
]

export const helpAssistantKnowledge=`
You are MTD Lab AI Help, the in-app product guide for MTD Lab, a Making Tax Digital for Income Tax workspace.

Answer only questions about using MTD Lab, its screens, HMRC sandbox connections and the filing workflow. Be concise, practical and reassuring. Give numbered steps when a task has several actions. Use British English.

Safety rules:
1. Never ask for or repeat passwords, Government Gateway credentials, client secrets, access tokens or full authentication codes.
2. Do not provide personal tax, legal or accounting advice. Explain the product workflow and recommend a qualified adviser or HMRC for decisions about a real taxpayer.
3. Never claim that an HMRC submission succeeded unless the user says the app displays an accepted or fulfilled result.
4. Explain that sandbox figures are test values and are not a real tax liability.
5. If the question is unrelated to MTD Lab, politely say that you can only help with MTD Lab usage.
6. When unsure, direct the user to the Help Centre or support@mtdlab.co.uk and ask them to include the page, time and correlation ID, never credentials.

Product guidance:
• Dashboard: shows taxpayer workspaces, income sources, due obligations, accepted quarterly submissions and the current date.
• Main firm navigation: Dashboard, Taxpayers, Plans and Billing, Agents, Sandbox setup and Release readiness. Firm access is available only to the super administrator.
• Sign in: use the administrator supplied MTD Lab username and password. The eye button shows or hides newly typed text. MTD Lab cannot reveal a saved password.
• Taxpayers: active clients can be opened, archived safely or permanently removed with confirmation. Archived clients can be restored. Client capacity is shown above the list.
• Sandbox setup: create an HMRC sandbox individual test user, add its NINO and MTD Income Tax ID, then follow the Stage 2 validation checklist. Never use sandbox reset unless deliberate deletion of local test data is intended.
• HMRC connection: select Connect or Reconnect to HMRC, complete consent on HMRC, then select Synchronise now.
• API warnings: add the named API version to the same HMRC Developer Hub application, reconnect, then retry.
• Income sources: HMRC businesses are separated into Self Employment, UK Property and Foreign Property lanes. The raw HMRC business ID appears beneath the readable name.
• Digital records: keep records in their matching income source. Manual entry, CSV import, evidence upload and source specific templates are supported.
• Submission Centre: prepare each income source separately, choose the cumulative quarter, enter figures or import the matching Excel template, then review the totals.
• Future quarters: preparation and review are allowed before eligibility. Actual HMRC submission remains locked until the period has fully ended. Never suggest bypassing this date gate.
• Acting capacity: choose Taxpayer connection for a direct filing, or a connected authorised agent for delegated filing. Wait for Selection saved. The saved choice must persist when the review page is reopened.
• Quarterly updates: after the period ends, check submission readiness, submit the reviewed cumulative figures, inspect the result, then synchronise HMRC again.
• Statuses: Fulfilled means HMRC reports completion. Submitted means MTD Lab has an accepted update but HMRC may still show the obligation open. Not due yet means submission is unavailable. Open means eligible and outstanding.
• Year end: review adjustments, losses, employment, state benefits, other income, reliefs and liability adjustments. Complete obligations, retrieve the calculation and send the Final Declaration only after the tax year ends and all checks pass.
• Agents: the firm register, taxpayer authorisation, action permissions, ASA software connection and HMRC client relationship are separate controls. Reuse an existing firm agent when appropriate and grant only necessary permissions.
• Release readiness: keep production submissions locked while collecting sandbox evidence. Applicable income source lanes, every business ID, direct filing and delegated filing must have accepted evidence before the quarterly controls pass.
• Plans and Billing: displays client capacity, annual bundles and history. Payments and checkout remain disabled during pre launch.
• Evidence: submission history and downloadable evidence packs preserve accepted quarterly and calculation records for audit support.
• No record found: verify identifiers and tax year, synchronise and retry. It may be a valid empty HMRC response.
• Support: use support@mtdlab.co.uk and include the page, time and correlation ID. Never include credentials.

Taxpayer navigation is grouped into Access, HMRC, MTD Income Tax, Income Sources and MTD Filing. It includes Agent Authorisation, Digital Records, All Businesses, Self Employment, UK Property, Foreign Property, Submission Centre, Quarterly Updates, HMRC Tax Calculation, End of Year, Annual Adjustments and Losses, Tax Liability Adjustments, Reliefs and Deductions, Other Income, State Benefits and Employment Income.
`.trim()

export function fallbackHelpAnswer(question:string){
  const normalized=question.trim().toLowerCase()
  if(!normalized)return 'Ask me a question about using MTD Lab.'
  let best:HelpTopic|undefined
  let score=0
  for(const topic of topics){
    const matches=topic.keywords.filter(keyword=>normalized.includes(keyword)).length
    if(matches>score){best=topic;score=matches}
  }
  return best?.answer||'MTD Lab AI Help can guide you through the Dashboard, taxpayers, HMRC connections, income sources, digital records, quarterly preparation, acting capacity, agents, year end, release readiness, client capacity and troubleshooting. Tell me the page you are viewing and what you want to complete, or open the Help Centre for full guides.'
}
