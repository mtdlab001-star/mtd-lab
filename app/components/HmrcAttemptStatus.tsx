function hmrcMessage(payload:any){
  if(!payload)return ''
  if(typeof payload==='string')return payload
  const error=Array.isArray(payload.failures)?payload.failures[0]:null
  return payload.message||payload.code||error?.reason||error?.message||payload.raw||''
}

function fmt(value:any){
  return value?new Date(value).toLocaleString('en-GB'):'Not recorded'
}

export default function HmrcAttemptStatus({attempt,label}:{attempt:any;label:string}){
  if(!attempt)return null
  const payload=attempt.response_summary||attempt.response_payload
  const message=hmrcMessage(payload)
  if(attempt.status==='accepted'){
    return <div className="status" style={{marginTop:12}}>
      <strong>{label} retrieved from HMRC.</strong>
      <div className="muted">Latest attempt: {fmt(attempt.created_at)}.</div>
      {attempt.hmrc_correlation_id&&<div className="muted">Correlation ID: <span className="mono">{attempt.hmrc_correlation_id}</span></div>}
    </div>
  }
  return <div className="status statusError" style={{marginTop:12}}>
    <strong>{label} retrieval was rejected by HMRC.</strong>
    <div>{message||`HMRC returned status ${attempt.hmrc_status||'unknown'}.`}</div>
    <div className="muted">HTTP status: {attempt.hmrc_status||'not recorded'} · Attempt ID: <span className="mono">{attempt.id}</span> · Last tried: {fmt(attempt.created_at)}</div>
    {attempt.hmrc_correlation_id&&<div className="muted">Correlation ID: <span className="mono">{attempt.hmrc_correlation_id}</span></div>}
  </div>
}
