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
    answer:'Create an individual test user in the HMRC Developer Hub. In MTD Lab, open Taxpayers and add the NINO and MTD Income Tax ID. Keep the Government Gateway test password outside MTD Lab because it is entered only on HMRC pages.',
  },
  {
    keywords:['digital record','income','expense','spreadsheet','template','import','transaction'],
    answer:'Open Digital Records for the correct source, such as Self Employment, UK Property or Foreign Property. Add transactions manually or download the matching spreadsheet template, import it, review rejected or duplicate rows, then confirm the totals before preparing an update.',
  },
  {
    keywords:['quarter','quarterly','obligation','submit update','not due','fulfilled','submitted'],
    answer:'Synchronise HMRC and open Quarterly Obligations. A quarterly update can be submitted only after its period has ended. Fulfilled means HMRC reports it complete. Submitted means MTD Lab has an accepted update while HMRC may still show the obligation as open. Synchronise again after acceptance.',
  },
  {
    keywords:['year end','final declaration','calculation','tax calculation','annual adjustment','loss','relief'],
    answer:'At year end, review business adjustments, losses, employment, state benefits, other income, reliefs and tax liability adjustments. Confirm all quarterly obligations are complete, retrieve and check the HMRC calculation, then send the Final Declaration only after the tax year has ended and every readiness check passes.',
  },
  {
    keywords:['agent','asa','agent services account','client authorisation'],
    answer:'Connect the organisation to its HMRC Agent Services Account, confirm the client has authorised that agent for MTD Income Tax, assign the required MTD Lab permissions, then select the agent acting capacity when preparing the filing.',
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
• Sign in: use the administrator supplied MTD Lab username and password. The eye button shows or hides newly typed text. MTD Lab cannot reveal a saved password.
• Taxpayers: create an HMRC sandbox individual test user, then add its NINO and MTD Income Tax ID in Taxpayers.
• HMRC connection: select Connect or Reconnect to HMRC, complete consent on HMRC, then select Synchronise now.
• API warnings: add the named API version to the same HMRC Developer Hub application, reconnect, then retry.
• Digital records: keep Self Employment, UK Property and Foreign Property records in their matching source. Manual entry and spreadsheet import are supported.
• Quarterly updates: synchronise, open Quarterly Obligations, wait until the period has ended, review cumulative figures, submit and synchronise again. Never advise submitting before the period end.
• Statuses: Fulfilled means HMRC reports completion. Submitted means MTD Lab has an accepted update but HMRC may still show the obligation open. Not due yet means submission is unavailable. Open means eligible and outstanding.
• Year end: review adjustments, losses, employment, state benefits, other income, reliefs and liability adjustments. Complete obligations, retrieve the calculation and send the Final Declaration only after the tax year ends and all checks pass.
• Agents: connect the Agent Services Account, confirm client authorisation and MTD Lab permissions, then use the correct acting capacity.
• No record found: verify identifiers and tax year, synchronise and retry. It may be a valid empty HMRC response.
• Support: use support@mtdlab.co.uk and include the page, time and correlation ID. Never include credentials.

Main navigation areas include Dashboard, Taxpayers, Taxpayer Overview, Digital Records, Quarterly Obligations, Submission Centre, Annual Adjustments, Employment Income, State Benefits, Other Income, Reliefs and Deductions, Tax Calculation, Agents and Help Centre.
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
  return best?.answer||'I can help with MTD Lab sign in, HMRC connections, taxpayers, digital records, quarterly updates, year end, agents and troubleshooting. Try asking what you want to do, or open the full Help Centre for step by step guides.'
}

