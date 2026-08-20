type HmrcErrorLike={code?:string;message?:string;path?:string|string[]}

const guidance:Record<string,string>={
  UNAUTHORIZED:'The HMRC authorisation is no longer valid. Reconnect this taxpayer to HMRC and try again.',
  INVALID_CREDENTIALS:'HMRC did not accept the current authorisation. Reconnect this taxpayer to HMRC.',
  CLIENT_OR_AGENT_NOT_AUTHORISED:'The current taxpayer or agent is not authorised for this HMRC action. Check the HMRC relationship and the MTD Lab agent permission.',
  INVALID_NINO:'Check the taxpayer NINO and synchronise HMRC again before submitting.',
  FORMAT_NINO:'The taxpayer NINO format is not valid. Correct it before continuing.',
  MATCHING_RESOURCE_NOT_FOUND:'HMRC could not find the matching taxpayer, business, obligation or calculation. Synchronise HMRC and check the selected income source.',
  NOT_FOUND:'HMRC could not find the requested record. Synchronise HMRC and confirm the taxpayer and business details.',
  RULE_TAX_YEAR_NOT_SUPPORTED:'The selected tax year is not supported by this HMRC operation.',
  RULE_TAX_YEAR_RANGE_INVALID:'Check the selected tax year and submission period.',
  RULE_PERIOD_NOT_ENDED:'This HMRC period is not yet available for the requested action.',
  RULE_PERIODIC_UPDATE_IS_INCOMPLETE:'Review the cumulative quarterly figures and complete all required values before submitting.',
  RULE_INCORRECT_OR_EMPTY_BODY_SUBMITTED:'Review the submitted figures. HMRC requires a valid non empty request body.',
  RULE_INCORRECT_GOV_TEST_SCENARIO:'The selected HMRC sandbox test scenario is not supported for this endpoint.',
  DUPLICATE_SUBMISSION:'HMRC indicates that this submission may already have been received. Review Submission History before trying again.',
  CONFLICT:'HMRC reported a conflict with the current record. Synchronise HMRC and review the latest submission state.',
  SERVER_ERROR:'HMRC returned a temporary server error. Do not duplicate the filing. Check Submission History and try again later if no acceptance is recorded.',
  SERVICE_UNAVAILABLE:'HMRC is temporarily unavailable. Keep the filing in its current state and retry after the service recovers.',
  TOO_MANY_REQUESTS:'HMRC is receiving too many requests. Wait before retrying this action.',
}

export function hmrcUserGuidance(code?:string,message?:string){
  const key=String(code||'').trim().toUpperCase()
  if(guidance[key])return guidance[key]
  if(key.includes('AUTH'))return 'Check the HMRC authorisation for this taxpayer or agent, then reconnect if necessary.'
  if(key.includes('NINO'))return 'Check the taxpayer NINO and synchronise HMRC again.'
  if(key.includes('BUSINESS'))return 'Check the selected HMRC business or income source and synchronise HMRC again.'
  if(key.includes('PERIOD')||key.includes('DATE'))return 'Check the tax year and submission period against the latest HMRC obligations.'
  if(key.includes('DUPLICATE')||key.includes('CONFLICT'))return 'Review the latest HMRC state and Submission History before trying again.'
  return message||'HMRC did not accept this request. Review the HMRC code, correct any highlighted information and try again.'
}

export function normaliseHmrcErrors(payload:any):Array<{code:string;message:string;path:string;guidance:string}>{
  const errors:HmrcErrorLike[]=Array.isArray(payload?.errors)?payload.errors:payload?.code?[payload]:[]
  if(!errors.length&&payload?.message)errors.push({code:'HMRC_ERROR',message:String(payload.message)})
  return errors.map((e:any)=>({
    code:String(e?.code||'HMRC_ERROR'),
    message:String(e?.message||'HMRC rejected this request'),
    path:Array.isArray(e?.path)?e.path.join(', '):String(e?.path||e?.paths||''),
    guidance:hmrcUserGuidance(e?.code,e?.message),
  }))
}
