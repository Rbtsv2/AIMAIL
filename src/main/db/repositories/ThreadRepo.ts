// src/main/db/repositories/ThreadRepo.ts
import { getDb, j, p } from '../index'
import type { ThreadFilter } from '@shared/search'
import type { Thread } from '@shared/models/Thread'
import type { Address } from '@shared/models/Message'

let OWN = new Set<string>()
export function setOwnAddresses(addrs: string[]): void { OWN = new Set(addrs.map((a) => a.toLowerCase())) }

function row(r: any): Thread {
  const lastFrom = p<Address | null>(r.last_from_json, null)
  return {
    id: r.id, accountId: r.account_id, subject: r.subject, snippet: r.snippet,
    participants: p<Address[]>(r.participants_json, []), lastDate: r.last_date, messageCount: r.message_count,
    unread: !!r.unread, starred: !!r.starred, hasAttachments: !!r.has_attachments,
    folderIds: p<string[]>(r.folder_ids ? `[${r.folder_ids.split(',').map((s: string) => JSON.stringify(s)).join(',')}]` : null, []),
    category: r.category ?? null,
    lastFromMe: !!lastFrom && OWN.has((lastFrom.address ?? '').toLowerCase()),
    replyState: r.reply_state ?? null
  }
}

const BASE = `SELECT t.*, (SELECT GROUP_CONCAT(DISTINCT folder_id) FROM messages WHERE thread_id = t.id) folder_ids, (SELECT category FROM messages WHERE thread_id = t.id AND category IS NOT NULL ORDER BY date DESC LIMIT 1) category, (SELECT from_json FROM messages WHERE thread_id = t.id ORDER BY date DESC LIMIT 1) last_from_json, (SELECT status FROM ai_replies r WHERE r.thread_id = t.id ORDER BY r.updated_at DESC LIMIT 1) reply_state FROM threads t`

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
  list(q: { accountId?: string; folderId?: string; role?: string; ids?: string[]; filter?: ThreadFilter; limit: number; offset: number }): Thread[] {
    const db = getDb()
    const where: string[] = []
    const args: unknown[] = []
    const f = q.filter ?? {}
    if (f.unread) where.push('t.unread > 0')
    if (f.starred) where.push('t.starred = 1')
    if (f.attachments) where.push('t.has_attachments = 1')
    if (f.after) { where.push('t.last_date >= ?'); args.push(f.after) }
    if (f.before) { where.push('t.last_date <= ?'); args.push(f.before) }
    if (f.category) { where.push('EXISTS (SELECT 1 FROM messages m WHERE m.thread_id = t.id AND m.category = ?)'); args.push(f.category) }
    if (f.from) { where.push('EXISTS (SELECT 1 FROM messages m WHERE m.thread_id = t.id AND lower(m.from_json) LIKE ?)'); args.push(`%${f.from.toLowerCase()}%`) }
    if (f.to) { where.push('EXISTS (SELECT 1 FROM messages m WHERE m.thread_id = t.id AND (lower(m.to_json) LIKE ? OR lower(m.cc_json) LIKE ?))'); args.push(`%${f.to.toLowerCase()}%`, `%${f.to.toLowerCase()}%`) }
    if (f.subject) { where.push('EXISTS (SELECT 1 FROM messages m WHERE m.thread_id = t.id AND lower(m.subject) LIKE ?)'); args.push(`%${f.subject.toLowerCase()}%`) }
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