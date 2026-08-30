import {generateText} from 'ai'
import {fallbackHelpAnswer,helpAssistantKnowledge,type HelpChatMessage} from '@/lib/help-assistant'
import {isSameOriginRequest} from '@/lib/request-security'

export const maxDuration=30

const WINDOW_MS=10*60*1000
const REQUEST_LIMIT=15
const requestLog=new Map<string,number[]>()

function clientIp(req:Request){
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ||req.headers.get('x-real-ip')
    ||'unknown'
}

function isRateLimited(req:Request){
  const now=Date.now()
  const ip=clientIp(req)
  if(requestLog.size>1000)requestLog.clear()
  const recent=(requestLog.get(ip)||[]).filter(time=>now-time<WINDOW_MS)
  if(recent.length>=REQUEST_LIMIT){
    requestLog.set(ip,recent)
    return true
  }
  recent.push(now)
  requestLog.set(ip,recent)
  return false
}

function validMessages(value:unknown):HelpChatMessage[]{
  if(!Array.isArray(value))return []
  return value.slice(-10).flatMap(item=>{
    if(!item||typeof item!=='object')return []
    const role='role'in item?item.role:null
    const text='text'in item?item.text:null
    if((role!=='user'&&role!=='assistant')||typeof text!=='string')return []
    const trimmed=text.trim().slice(0,1200)
    return trimmed?[{role,text:trimmed}]:[]
  })
}

export async function POST(req:Request){
  if(!isSameOriginRequest(req))return Response.json({error:'Invalid request origin.'},{status:403})
  if(isRateLimited(req)){
    return Response.json({error:'Too many questions. Please wait a few minutes and try again.'},{status:429})
  }

  let body:unknown
  try{body=await req.json()}catch{return Response.json({error:'Invalid request.'},{status:400})}
  if(!body||typeof body!=='object')return Response.json({error:'Invalid request.'},{status:400})

  const messages=validMessages('messages'in body?body.messages:null)
  const latest=[...messages].reverse().find(message=>message.role==='user')?.text
  if(!latest)return Response.json({error:'Please enter a question.'},{status:400})
  const pathnameValue='pathname'in body?body.pathname:null
  const page=typeof pathnameValue==='string'
    ?pathnameValue.slice(0,180)
    :'unknown'

  try{
    const result=await generateText({
      model:'openai/gpt-5.6-luna',
      instructions:`${helpAssistantKnowledge}\n\nThe user is currently viewing this route: ${page}. Use that only as helpful page context.`,
      messages:messages.map(message=>({role:message.role,content:message.text})),
      maxOutputTokens:500,
    })
    return new Response(result.text,{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}})
  }catch(error){
    console.error('AI Help request failed',error)
    return new Response(fallbackHelpAnswer(latest),{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-MTD-Help-Fallback':'true'}})
  }
}
