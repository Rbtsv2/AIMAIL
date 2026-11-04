import { getDb, j, p } from '../index'
import type { Draft } from '@shared/models/Draft'

export const DraftRepo = {
  list(accountId?: string): Draft[] {
    const db = getDb()
    const rows = accountId
      ? db.prepare('SELECT json FROM drafts WHERE account_id = ? ORDER BY updated_at DESC').all(accountId)
      : db.prepare('SELECT json FROM drafts ORDER BY updated_at DESC').all()
    return rows.map((r: any) => p<Draft>(r.json, null as unknown as Draft)).filter(Boolean)
  },
  get(draftId: string): Draft | undefined {
    const r = getDb().prepare('SELECT json FROM drafts WHERE id = ?').get(draftId) as any
    return r ? p<Draft>(r.json, undefined as unknown as Draft) : undefined
  },
  save(d: Draft): Draft {
    const next = { ...d, updatedAt: Date.now() }
    getDb().prepare('INSERT INTO drafts(id,account_id,json,updated_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at')
      .run(next.id, next.accountId, j(next), next.updatedAt)
    return next
  },
  delete(draftId: string): void {
    getDb().prepare('DELETE FROM drafts WHERE id = ?').run(draftId)
  }
}
