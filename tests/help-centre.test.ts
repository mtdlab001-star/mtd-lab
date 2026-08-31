import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

test('help centre is public, searchable and linked from sign in',()=>{
  const middleware=readFileSync('middleware.ts','utf8')
  const login=readFileSync('app/login/page.tsx','utf8')
  const help=readFileSync('app/help/HelpCentre.tsx','utf8')
  const forgot=readFileSync('app/forgot-password/page.tsx','utf8')
  const reset=readFileSync('app/reset-password/page.tsx','utf8')

  assert.match(middleware,/const publicPages=new Set\(\['\/login','\/help','\/forgot-password','\/reset-password'\]\)/)
  assert.match(middleware,/publicPages\.has\(path\)/)
  assert.match(login,/href="\/help"/)
  assert.match(login,/href="\/forgot-password"/)
  assert.doesNotMatch(login,/href="\/help#sign-in"/)
  assert.match(help,/Search the Help Centre/)
  assert.match(help,/Quarterly updates/)
  assert.match(help,/support@mtdlab\.co\.uk/)
  assert.match(forgot,/Reset your/)
  assert.match(forgot,/\/api\/auth\/forgot-password/)
  assert.match(reset,/Set a new/)
  assert.match(reset,/\/api\/auth\/reset-password/)
})
