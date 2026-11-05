// src/main/db/repositories/AiReplyRepo.ts
import { getDb } from '../index'
import type { AiReply, AiReplyStatus } from '@shared/models/AiReply'

const row = (r: any): AiReply => ({ messageId: r.message_id, threadId: r.thread_id, accountId: r.account_id, text: r.text, status: r.status, error: r.error ?? null, createdAt: r.created_at, updatedAt: r.updated_at, subject: r.subject ?? '', from: r.from_json ? (JSON.parse(r.from_json).name || JSON.parse(r.from_json).address) : '', fromAddress: r.from_json ? JSON.parse(r.from_json).address ?? '' : '', date: r.date ?? 0, snippet: r.snippet ?? '' })
// le message doit encore exister et ne pas être à la Corbeille / Indésirables : une réponse préparée suit le sort de son message
const JOIN = "SELECT a.*, m.subject, m.from_json, m.date, m.snippet FROM ai_replies a JOIN messages m ON m.id = a.message_id JOIN folders f ON f.id = m.folder_id AND f.role NOT IN ('trash','spam')"

export const AiReplyRepo = {
  list(statuses: AiReplyStatus[] = ['pending', 'generating', 'ready', 'error']): AiReply[] {
    const ph = statuses.map(() => '?').join(',')
    return getDb().prepare(`${JOIN} WHERE a.status IN (${ph}) ORDER BY m.date DESC`).all(...statuses).map(row)
  },
  byMessage(messageId: string): AiReply | undefined { const r = getDb().prepare(`${JOIN} WHERE a.message_id = ?`).get(messageId); return r ? row(r) : undefined },
  byThread(threadId: string): AiReply | undefined { const r = getDb().prepare(`${JOIN} WHERE a.thread_id = ? AND a.status IN ('pending','generating','ready','error') ORDER BY m.date DESC LIMIT 1`).get(threadId); return r ? row(r) : undefined },
  upsert(messageId: string, threadId: string, accountId: string, status: AiReplyStatus): void {
    getDb().prepare(`INSERT INTO ai_replies(message_id, thread_id, account_id, text, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(message_id) DO UPDATE SET status = excluded.status, error = NULL, updated_at = excluded.updated_at`).run(messageId, threadId, accountId, '', status, Date.now(), Date.now())
  },
  setResult(messageId: string, text: string): void { getDb().prepare("UPDATE ai_replies SET text = ?, status = 'ready', error = NULL, updated_at = ? WHERE message_id = ?").run(text, Date.now(), messageId) },
  setText(messageId: string, text: string): void { getDb().prepare('UPDATE ai_replies SET text = ?, updated_at = ? WHERE message_id = ?').run(text, Date.now(), messageId) },
  setStatus(messageId: string, status: AiReplyStatus, error?: string): void { getDb().prepare('UPDATE ai_replies SET status = ?, error = ?, updated_at = ? WHERE message_id = ?').run(status, error ?? null, Date.now(), messageId) },
  markThreadSent(threadId: string): number { return getDb().prepare("UPDATE ai_replies SET status = 'sent', updated_at = ? WHERE thread_id = ? AND status IN ('pending','generating','ready','error')").run(Date.now(), threadId).changes },
  counts(): { ready: number; generating: number } {
    const r = getDb().prepare("SELECT SUM(a.status = 'ready') ready, SUM(a.status IN ('pending','generating')) generating FROM ai_replies a JOIN messages m ON m.id = a.message_id JOIN folders f ON f.id = m.folder_id AND f.role NOT IN ('trash','spam')").get() as any
    return { ready: r?.ready ?? 0, generating: r?.generating ?? 0 }
  }
}