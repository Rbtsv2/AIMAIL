import { createHash } from 'crypto'
import type { MessageHeader } from '@shared/models/Message'

export const normalizeSubject = (s: string): string =>
  s.replace(/^(\s*(re|fw|fwd|tr|aw|wg)\s*:\s*)+/i, '').replace(/\s+/g, ' ').trim().toLowerCase()

export interface ThreadLookup {
  byMessageId(messageId: string): MessageHeader | undefined
}

export function resolveThreadId(accountId: string, h: { messageId: string; inReplyTo: string | null; references: string[]; subject: string }, lookup: ThreadLookup): string {
  const candidates = [...h.references].reverse()
  if (h.inReplyTo) candidates.unshift(h.inReplyTo)
  for (const mid of candidates) {
    const found = lookup.byMessageId(mid)
    if (found) return found.threadId
  }
  const key = candidates.length ? candidates[candidates.length - 1] : `${normalizeSubject(h.subject)}|${h.messageId}`
  return createHash('sha1').update(`${accountId}|${key}`).digest('hex').slice(0, 24)
}
