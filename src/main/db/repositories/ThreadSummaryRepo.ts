// src/main/db/repositories/ThreadSummaryRepo.ts
import { getDb } from '../index'

export interface ThreadSummary { threadId: string; uptoMessageId: string; messageCount: number; summary: string; updatedAt: number }

export const ThreadSummaryRepo = {
  get(threadId: string): ThreadSummary | undefined {
    const r = getDb().prepare('SELECT * FROM thread_summaries WHERE thread_id = ?').get(threadId) as any
    return r ? { threadId: r.thread_id, uptoMessageId: r.upto_message_id, messageCount: r.message_count, summary: r.summary, updatedAt: r.updated_at } : undefined
  },
  set(s: ThreadSummary): void {
    getDb().prepare('INSERT INTO thread_summaries(thread_id,upto_message_id,message_count,summary,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(thread_id) DO UPDATE SET upto_message_id=excluded.upto_message_id, message_count=excluded.message_count, summary=excluded.summary, updated_at=excluded.updated_at')
      .run(s.threadId, s.uptoMessageId, s.messageCount, s.summary, s.updatedAt)
  }
}