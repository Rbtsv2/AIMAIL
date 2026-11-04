import { describe, it, expect } from 'vitest'
import { normalizeSubject, resolveThreadId } from '../../src/main/sync/Threader'

describe('Threader', () => {
  it('normalise les préfixes', () => {
    expect(normalizeSubject('Re: RE: Fwd: Devis')).toBe('devis')
    expect(normalizeSubject('TR : facture  mars')).toBe('facture mars')
  })
  it('rattache via In-Reply-To', () => {
    const lookup = { byMessageId: (mid: string) => (mid === '<a@x>' ? ({ threadId: 'T1' } as any) : undefined) }
    expect(resolveThreadId('acc', { messageId: '<b@x>', inReplyTo: '<a@x>', references: [], subject: 'Re: hello' }, lookup)).toBe('T1')
  })
  it('crée un id stable sur la racine des références', () => {
    const lookup = { byMessageId: () => undefined }
    const a = resolveThreadId('acc', { messageId: '<c@x>', inReplyTo: null, references: ['<root@x>', '<mid@x>'], subject: 's' }, lookup)
    const b = resolveThreadId('acc', { messageId: '<d@x>', inReplyTo: null, references: ['<root@x>'], subject: 's' }, lookup)
    expect(a).toBe(b)
  })
})
