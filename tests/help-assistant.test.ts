import test from 'node:test'
import assert from 'node:assert/strict'
import {shouldShowAIHelp} from '../lib/ai-help-visibility.ts'
import {fallbackHelpAnswer,helpAssistantKnowledge} from '../lib/help-assistant.ts'

test('fallback assistant guides quarterly submissions safely',()=>{
  const answer=fallbackHelpAnswer('Can I submit my quarterly update before the period ends?')
  assert.match(answer,/only after its period has ended/i)
  assert.match(answer,/Synchronise again/i)
})

test('fallback assistant explains password visibility',()=>{
  const answer=fallbackHelpAnswer('How can I reveal my password on the sign in page?')
  assert.match(answer,/eye button/i)
  assert.match(answer,/cannot reveal a saved password/i)
})

test('assistant knowledge prohibits credential collection and tax advice',()=>{
  assert.match(helpAssistantKnowledge,/Never ask for or repeat passwords/i)
  assert.match(helpAssistantKnowledge,/Do not provide personal tax, legal or accounting advice/i)
})

test('fallback assistant keeps unknown questions within product scope',()=>{
  const answer=fallbackHelpAnswer('What can you help me with?')
  assert.match(answer,/MTD Lab/i)
  assert.match(answer,/Help Centre/i)
})

test('AI Help is hidden on public pre-login pages only',()=>{
  assert.equal(shouldShowAIHelp('/login'),false)
  assert.equal(shouldShowAIHelp('/login?next=%2Ftaxpayers'),false)
  assert.equal(shouldShowAIHelp('/forgot-password'),false)
  assert.equal(shouldShowAIHelp('/forgot-password?sent=1'),false)
  assert.equal(shouldShowAIHelp('/taxpayers'),true)
  assert.equal(shouldShowAIHelp('/help'),true)
})
