// src/main/db/repositories/FolderRepo.ts
import { getDb, id } from '../index'
import type { Folder, FolderRole } from '@shared/models/Folder'

function row(r: any): Folder {
  return {
    id: r.id, accountId: r.account_id, path: r.path, name: r.name, role: r.role, delimiter: r.delimiter,
    unread: r.unread, total: r.total, uidValidity: r.uid_validity, uidNext: r.uid_next, sortOrder: r.sort_order ?? null, noselect: !!r.noselect
  }
}

export const FolderRepo = {
  list(accountId: string): Folder[] {
    return getDb().prepare('SELECT * FROM folders WHERE account_id = ? ORDER BY role, name').all(accountId).map(row)
  },
  get(folderId: string): Folder | undefined {
    const r = getDb().prepare('SELECT * FROM folders WHERE id = ?').get(folderId)
    return r ? row(r) : undefined
  },
  byRole(accountId: string, role: FolderRole): Folder | undefined {
    const r = getDb().prepare('SELECT * FROM folders WHERE account_id = ? AND role = ? LIMIT 1').get(accountId, role)
    return r ? row(r) : undefined
  },
  upsert(f: Omit<Folder, 'id' | 'unread' | 'total' | 'sortOrder' | 'noselect'> & Partial<Folder>): Folder {
    const db = getDb()
    const existing = db.prepare('SELECT * FROM folders WHERE account_id = ? AND path = ?').get(f.accountId, f.path) as any
    if (existing) {
      db.prepare('UPDATE folders SET name=?, role=?, delimiter=?, uid_validity=?, uid_next=?, noselect=? WHERE id=?')
        .run(f.name, f.role, f.delimiter, f.uidValidity, f.uidNext, f.noselect ? 1 : 0, existing.id)
      return row({ ...existing, name: f.name, role: f.role, uid_validity: f.uidValidity, uid_next: f.uidNext, noselect: f.noselect ? 1 : 0 })
    }
    const fid = id()
    db.prepare('INSERT INTO folders(id,account_id,path,name,role,delimiter,uid_validity,uid_next,noselect) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(fid, f.accountId, f.path, f.name, f.role, f.delimiter, f.uidValidity, f.uidNext, f.noselect ? 1 : 0)
    return this.get(fid)!
  },
  reorder(orderedIds: string[]): void {
    const stmt = getDb().prepare('UPDATE folders SET sort_order = ? WHERE id = ?')
    orderedIds.forEach((id, i) => stmt.run(i, id))
  },
  setCounts(folderId: string, unread: number, total: number): void {
    getDb().prepare('UPDATE folders SET unread=?, total=? WHERE id=?').run(unread, total, folderId)
  },
  recount(folderId: string): void {
    const r = getDb().prepare('SELECT COUNT(*) total, SUM(unread) unread FROM messages WHERE folder_id = ?').get(folderId) as any
    this.setCounts(folderId, r.unread ?? 0, r.total ?? 0)
  },
  setUidState(folderId: string, uidValidity: number, uidNext: number): void {
    getDb().prepare('UPDATE folders SET uid_validity=?, uid_next=? WHERE id=?').run(uidValidity, uidNext, folderId)
  },
  resetFolder(folderId: string): void {
    getDb().prepare('DELETE FROM messages WHERE folder_id = ?').run(folderId)
  },
  rootPrefix(accountId: string, delimiter: string): string {
    const r = getDb().prepare('SELECT 1 FROM folders WHERE account_id = ? AND path LIKE ? LIMIT 1').get(accountId, `INBOX${delimiter}%`)
    return r ? `INBOX${delimiter}` : ''
  },
  renamePaths(accountId: string, oldPath: string, newPath: string, delimiter: string): void {
    const db = getDb()
    db.prepare('UPDATE folders SET path = ?, name = ? WHERE account_id = ? AND path = ?').run(newPath, newPath.split(delimiter).pop(), accountId, oldPath)
    const children = db.prepare('SELECT id, path FROM folders WHERE account_id = ? AND path LIKE ?').all(accountId, `${oldPath}${delimiter}%`) as any[]
    const upd = db.prepare('UPDATE folders SET path = ? WHERE id = ?')
    for (const ch of children) upd.run(newPath + ch.path.slice(oldPath.length), ch.id)
  },
  removeMissing(accountId: string, keepPaths: string[]): void {
    const db = getDb()
    const ph = keepPaths.map(() => '?').join(',') || "''"
    db.prepare(`DELETE FROM folders WHERE account_id = ? AND path NOT IN (${ph})`).run(accountId, ...keepPaths)
  }
}