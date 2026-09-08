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

test('fallback assistant explains preparation mode without bypassing eligibility',()=>{
  const answer=fallbackHelpAnswer('What does preparation mode mean for a future quarter?')
  assert.match(answer,/does not send anything to HMRC/i)
  assert.match(answer,/submission becomes available/i)
})

test('fallback assistant explains saved acting capacity',()=>{
  const answer=fallbackHelpAnswer('How do I save the acting capacity?')
  assert.match(answer,/Taxpayer connection/i)
  assert.match(answer,/Selection saved/i)
  assert.match(answer,/preserves that choice/i)
})

test('fallback assistant explains the release readiness gate',()=>{
  const answer=fallbackHelpAnswer('Why is release readiness validation incomplete?')
  assert.match(answer,/accepted sandbox submissions/i)
  assert.match(answer,/production submissions locked/i)
})

test('AI Help is hidden on public pre-login pages only',()=>{
  assert.equal(shouldShowAIHelp('/login'),false)
  assert.equal(shouldShowAIHelp('/login?next=%2Ftaxpayers'),false)
  assert.equal(shouldShowAIHelp('/forgot-password'),false)
  assert.equal(shouldShowAIHelp('/forgot-password?sent=1'),false)
  assert.equal(shouldShowAIHelp('/taxpayers'),true)
  assert.equal(shouldShowAIHelp('/help'),true)
})
