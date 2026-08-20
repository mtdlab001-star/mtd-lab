export function isSameOriginRequest(req:Request){
  const target=new URL(req.url)
  const origin=req.headers.get('origin')
  if(origin){try{return new URL(origin).origin===target.origin}catch{return false}}
  const referer=req.headers.get('referer')
  if(referer){try{return new URL(referer).origin===target.origin}catch{return false}}
  return false
}
