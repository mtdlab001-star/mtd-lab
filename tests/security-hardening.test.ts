import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

function filesWith(pattern:string,args:string[]=[]){
  const output=execFileSync('rg',['-l',pattern,...args],{encoding:'utf8'})
  return output.trim().split('\n').filter(Boolean)
}

test('all POST API routes reject cross-site requests',()=>{
  const files=filesWith('export async function POST',['app/api','-g','*.ts'])
  assert.ok(files.length>0,'Expected POST API routes to be scanned')
  for(const file of files){
    const source=readFileSync(file,'utf8')
    assert.match(source,/isSameOriginRequest\(req\)/,`${file} must call isSameOriginRequest(req)`)
  }
})

test('security headers deny framing and do not allow eval',()=>{
  const middleware=readFileSync('middleware.ts','utf8')
  assert.match(middleware,/frame-ancestors 'none'/)
  assert.match(middleware,/X-Frame-Options','DENY'/)
  assert.doesNotMatch(middleware,/unsafe-eval/)
})
