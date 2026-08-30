'use client'

import {useEffect,useRef,useState} from 'react'
import {usePathname} from 'next/navigation'
import s from './ai-help-widget.module.css'

type ChatMessage={
  id:string
  role:'user'|'assistant'
  text:string
}

const welcome:ChatMessage={
  id:'welcome',
  role:'assistant',
  text:'Hello, I am MTD Lab AI Help. Ask me how to use any part of the app.',
}

const suggestions=[
  'How do I connect HMRC?',
  'When can I submit a quarterly update?',
  'How do I complete year end?',
]

export default function AIHelpWidget(){
  const pathname=usePathname()
  const [open,setOpen]=useState(false)
  const [input,setInput]=useState('')
  const [messages,setMessages]=useState<ChatMessage[]>([welcome])
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const endRef=useRef<HTMLDivElement>(null)
  const inputRef=useRef<HTMLInputElement>(null)

  useEffect(()=>{
    if(!open)return
    inputRef.current?.focus()
    const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)}
    window.addEventListener('keydown',close)
    return()=>window.removeEventListener('keydown',close)
  },[open])

  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'})},[messages,loading])

  async function ask(question:string){
    const text=question.trim()
    if(!text||loading)return
    const userMessage:ChatMessage={id:crypto.randomUUID(),role:'user',text}
    const nextMessages=[...messages,userMessage]
    setMessages(nextMessages)
    setInput('')
    setError('')
    setLoading(true)
    try{
      const response=await fetch('/api/help-chat',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          pathname,
          messages:nextMessages.filter(message=>message.id!=='welcome').map(({role,text})=>({role,text})),
        }),
      })
      if(!response.ok){
        const problem=await response.json().catch(()=>null) as {error?:string}|null
        throw new Error(problem?.error||'AI Help is unavailable right now.')
      }
      const answer=(await response.text()).trim()
      if(!answer)throw new Error('AI Help returned an empty answer. Please try again.')
      setMessages(current=>[...current,{id:crypto.randomUUID(),role:'assistant',text:answer}])
    }catch(reason){
      setError(reason instanceof Error?reason.message:'AI Help is unavailable right now.')
    }finally{
      setLoading(false)
    }
  }

  return <div className={s.widget}>
    {open?<section className={s.panel} role="dialog" aria-label="MTD Lab AI Help">
      <header className={s.header}>
        <div className={s.avatar} aria-hidden="true">AI</div>
        <div><strong>MTD Lab AI Help</strong><span><i/>Online guide</span></div>
        <button type="button" onClick={()=>setOpen(false)} aria-label="Close AI Help">×</button>
      </header>

      <div className={s.messages} aria-live="polite">
        {messages.map(message=><div className={`${s.message} ${message.role==='user'?s.user:s.assistant}`} key={message.id}>
          <span>{message.role==='user'?'You':'AI Help'}</span>
          <p>{message.text}</p>
        </div>)}
        {messages.length===1?<div className={s.suggestions}>
          <span>Popular questions</span>
          {suggestions.map(suggestion=><button type="button" onClick={()=>ask(suggestion)} key={suggestion}>{suggestion}</button>)}
        </div>:null}
        {loading?<div className={`${s.message} ${s.assistant}`}><span>AI Help</span><div className={s.thinking} aria-label="Preparing an answer"><i/><i/><i/></div></div>:null}
        {error?<div className={s.error} role="alert">{error}</div>:null}
        <div ref={endRef}/>
      </div>

      <form className={s.form} onSubmit={event=>{event.preventDefault();void ask(input)}}>
        <label htmlFor="ai-help-question">Ask about MTD Lab</label>
        <div>
          <input ref={inputRef} id="ai-help-question" value={input} onChange={event=>setInput(event.target.value)} maxLength={800} disabled={loading} placeholder="Type your question..." autoComplete="off"/>
          <button type="submit" disabled={loading||!input.trim()} aria-label="Send question">➤</button>
        </div>
      </form>
      <footer>Do not share passwords or access tokens. <a href="/help">Full Help Centre</a></footer>
    </section>:null}

    <button className={s.launcher} type="button" onClick={()=>setOpen(current=>!current)} aria-expanded={open} aria-label={open?'Close AI Help':'Open AI Help'}>
      <span aria-hidden="true">{open?'×':'✦'}</span><b>{open?'Close':'AI Help'}</b>
    </button>
  </div>
}

