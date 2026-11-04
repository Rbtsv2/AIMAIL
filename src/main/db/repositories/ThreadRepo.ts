// src/main/db/repositories/ThreadRepo.ts
import { getDb, j, p } from '../index'
import type { Thread } from '@shared/models/Thread'
import type { Address } from '@shared/models/Message'

function row(r: any): Thread {
  return {
    id: r.id, accountId: r.account_id, subject: r.subject, snippet: r.snippet,
    participants: p<Address[]>(r.participants_json, []), lastDate: r.last_date, messageCount: r.message_count,
    unread: !!r.unread, starred: !!r.starred, hasAttachments: !!r.has_attachments,
    folderIds: p<string[]>(r.folder_ids ? `[${r.folder_ids.split(',').map((s: string) => JSON.stringify(s)).join(',')}]` : null, []),
    category: r.category ?? null
  }
}

const BASE = `SELECT t.*, (SELECT GROUP_CONCAT(DISTINCT folder_id) FROM messages WHERE thread_id = t.id) folder_ids, (SELECT category FROM messages WHERE thread_id = t.id AND category IS NOT NULL ORDER BY date DESC LIMIT 1) category FROM threads t`

export const ThreadRepo = {
  get(threadId: string): Thread | undefined {
    const r = getDb().prepare(`${BASE} WHERE t.id = ?`).get(threadId)
    return r ? row(r) : undefined
  },
  ensure(threadId: string, accountId: string, subject: string, date: number): void {
    getDb().prepare('INSERT OR IGNORE INTO threads(id,account_id,subject,last_date) VALUES (?,?,?,?)').run(threadId, accountId, subject, date)
  },
  recompute(threadId: string): void {
    const db = getDb()
    const agg = db.prepare(`SELECT COUNT(*) c, MAX(date) d, MAX(unread) u, MAX(starred) s, MAX(has_attachments) a FROM messages WHERE thread_id = ?`).get(threadId) as any
    if (!agg.c) { db.prepare('DELETE FROM threads WHERE id = ?').run(threadId); return }
    const last = db.prepare('SELECT snippet, subject FROM messages WHERE thread_id = ? ORDER BY date DESC LIMIT 1').get(threadId) as any
    const parts = db.prepare('SELECT from_json FROM messages WHERE thread_id = ? ORDER BY date DESC').all(threadId) as any[]
    const seen = new Set<string>()
    const participants: Address[] = []
    for (const r of parts) {
      const a = p<Address>(r.from_json, { name: '', address: '' })
      if (a.address && !seen.has(a.address)) { seen.add(a.address); participants.push(a) }
    }
    db.prepare(`UPDATE threads SET snippet=?, subject=?, participants_json=?, last_date=?, message_count=?, unread=?, starred=?, has_attachments=? WHERE id=?`)
      .run(last.snippet, last.subject, j(participants), agg.d, agg.c, agg.u ?? 0, agg.s ?? 0, agg.a ?? 0, threadId)
  },
  list(q: { accountId?: string; folderId?: string; role?: string; ids?: string[]; limit: number; offset: number }): Thread[] {
    const db = getDb()
    const where: string[] = []
    const args: unknown[] = []
    if (q.accountId) { where.push('t.account_id = ?'); args.push(q.accountId) }
    if (q.ids) {
      if (!q.ids.length) return []
      where.push(`t.id IN (${q.ids.map(() => '?').join(',')})`); args.push(...q.ids)
    } else if (q.folderId) {
      where.push('EXISTS (SELECT 1 FROM messages m WHERE m.thread_id = t.id AND m.folder_id = ?)'); args.push(q.folderId)
    } else if (q.role === 'starred') {
      where.push('t.starred = 1')
    } else if (q.role) {
      where.push('EXISTS (SELECT 1 FROM messages m JOIN folders f ON f.id = m.folder_id WHERE m.thread_id = t.id AND f.role = ?)'); args.push(q.role)
    }
    const sql = `${BASE} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY t.last_date DESC LIMIT ? OFFSET ?`
    return db.prepare(sql).all(...args, q.limit, q.offset).map(row)
  },
  threadIdsForMessages(ids: string[]): string[] {
    if (!ids.length) return []
    const ph = ids.map(() => '?').join(',')
    return getDb().prepare(`SELECT DISTINCT thread_id FROM messages WHERE id IN (${ph})`).all(...ids).map((r: any) => r.thread_id)
  }
}