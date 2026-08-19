import crypto from 'node:crypto'

function secret(){
  const value=process.env.HMRC_STATE_SECRET
  if(!value) throw new Error('HMRC_STATE_SECRET is missing')
  return value
}

export function signReviewPayload(payload:unknown){
  const body=Buffer.from(JSON.stringify(payload),'utf8').toString('base64url')
  const sig=crypto.createHmac('sha256',secret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyReviewPayload(token:string){
  const [body,sig]=token.split('.')
  if(!body||!sig) return null
  const expected=crypto.createHmac('sha256',secret()).update(body).digest()
  let supplied:Buffer
  try{supplied=Buffer.from(sig,'base64url')}catch{return null}
  if(expected.length!==supplied.length||!crypto.timingSafeEqual(expected,supplied)) return null
  try{return JSON.parse(Buffer.from(body,'base64url').toString('utf8'))}catch{return null}
}
