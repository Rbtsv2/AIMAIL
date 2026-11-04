import { describe, it, expect } from 'vitest'
import { buildMessages } from '../../src/main/ai/PromptBuilder'
import { DEFAULT_AI_SETTINGS } from '../../src/shared/ai/AiSettings'

const account = { id: 'a', email: 'c@x.fr', name: 'Charles', aiInstructions: 'Signe Charles.' } as any
const msg = { from: { name: 'Bob', address: 'bob@y.fr' }, date: 0, subject: 'Devis', bodyText: 'Bonjour, prix ?', snippet: '' } as any

describe('PromptBuilder', () => {
  it('injecte les instructions globales, compte et tâche', () => {
    const s = { ...DEFAULT_AI_SETTINGS, globalInstructions: 'Phrases courtes.', taskInstructions: { reply: 'Propose un rendez-vous.' } }
    const [sys, user] = buildMessages({ task: 'reply', accountId: 'a' }, s, account, [msg])
    expect(sys.content).toContain('Phrases courtes.')
    expect(sys.content).toContain('Signe Charles.')
    expect(sys.content).toContain('Propose un rendez-vous.')
    expect(user.content).toContain('bob@y.fr')
  })
})
