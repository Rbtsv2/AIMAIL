// src/main/db/repositories/MessageRepo.ts
import { getDb, j, p } from '../index'
import type { Message, MessageHeader, Address } from '@shared/models/Message'
import type { Attachment } from '@shared/models/Attachment'

const addrText = (a: Address[]): string => a.map((x) => `${x.name} ${x.address}`).join(' ')

function attRow(r: any): Attachment {
  return {
    id: r.id, messageId: r.message_id, filename: r.filename, mimeType: r.mime_type, size: r.size,
    contentId: r.content_id, inline: !!r.inline, partId: r.part_id, localPath: r.local_path, text: r.text ?? null
  }
}

function row(r: any, withBody: boolean): Message {
  return {
    id: r.id, accountId: r.account_id, folderId: r.folder_id, threadId: r.thread_id, uid: r.uid,
    messageId: r.message_id, inReplyTo: r.in_reply_to, references: p<string[]>(r.references_json, []),
    from: p<Address>(r.from_json, { name: '', address: '' }),
    to: p<Address[]>(r.to_json, []), cc: p<Address[]>(r.cc_json, []), bcc: p<Address[]>(r.bcc_json, []),
    replyTo: p<Address[]>(r.reply_to_json, []),
    subject: r.subject, snippet: r.snippet, date: r.date, unread: !!r.unread, starred: !!r.starred,
    hasAttachments: !!r.has_attachments,
    bodyHtml: withBody ? r.body_html : null, bodyText: withBody ? r.body_text : null,
    bodyFetched: !!r.body_fetched, category: r.category ?? null, attachments: []
  }
}

export const MessageRepo = {
  get(messageId: string): Message | undefined {
    const r = getDb().prepare('SELECT * FROM messages WHERE id = ?').get(messageId)
    if (!r) return undefined
    const m = row(r, true)
    m.attachments = this.attachments(messageId)
    return m
  },
  attachments(messageId: string): Attachment[] {
    return getDb().prepare('SELECT * FROM attachments WHERE message_id = ?').all(messageId).map(attRow)
  },
  attachment(attachmentId: string): Attachment | undefined {
    const r = getDb().prepare('SELECT * FROM attachments WHERE id = ?').get(attachmentId)
    return r ? attRow(r) : undefined
  },
  replaceAttachments(messageId: string, atts: Attachment[]): void {
    const db = getDb()
    db.prepare('DELETE FROM attachments WHERE message_id = ?').run(messageId)
    const ins = db.prepare('INSERT INTO attachments(id,message_id,filename,mime_type,size,content_id,inline,part_id,local_path) VALUES (?,?,?,?,?,?,?,?,?)')
    for (const a of atts) ins.run(a.id, messageId, a.filename, a.mimeType, a.size, a.contentId, a.inline ? 1 : 0, a.partId, a.localPath)
    db.prepare('UPDATE messages SET has_attachments = ? WHERE id = ?').run(atts.some((a) => !a.inline) ? 1 : 0, messageId)
  },
  setAttachmentText(attachmentId: string, text: string): void {
    const db = getDb()
    db.prepare('UPDATE attachments SET text = ? WHERE id = ?').run(text, attachmentId)
    const r = db.prepare('SELECT message_id FROM attachments WHERE id = ?').get(attachmentId) as any
    if (!r) return
    const all = (db.prepare('SELECT filename, text FROM attachments WHERE message_id = ? AND text IS NOT NULL').all(r.message_id) as any[]).map((a) => `${a.filename}\n${a.text}`).join('\n\n')
    db.prepare('UPDATE messages_fts SET attachment_text = ? WHERE id = ?').run(all.slice(0, 60000), r.message_id)
  },
  setAttachmentPath(attachmentId: string, localPath: string): void {
    getDb().prepare('UPDATE attachments SET local_path = ? WHERE id = ?').run(localPath, attachmentId)
  },
  byThread(threadId: string): Message[] {
    return getDb().prepare('SELECT * FROM messages WHERE thread_id = ? ORDER BY date ASC').all(threadId)
      .map((r) => { const m = row(r, true); m.attachments = this.attachments(m.id); return m })
  },
  byMessageId(accountId: string, messageId: string): MessageHeader | undefined {
    const r = getDb().prepare('SELECT * FROM messages WHERE account_id = ? AND message_id = ? LIMIT 1').get(accountId, messageId)
    return r ? row(r, false) : undefined
  },
  byUid(folderId: string, uid: number): MessageHeader | undefined {
    const r = getDb().prepare('SELECT * FROM messages WHERE folder_id = ? AND uid = ?').get(folderId, uid)
    return r ? row(r, false) : undefined
  },
  setCategory(messageId: string, category: string | null): void {
    getDb().prepare('UPDATE messages SET category=? WHERE id=?').run(category, messageId)
  },
  setSnippet(messageId: string, snippet: string): void {
    getDb().prepare('UPDATE messages SET snippet=? WHERE id=?').run(snippet, messageId)
  },
  existsUid(folderId: string, uid: number): boolean {
    return !!getDb().prepare('SELECT 1 FROM messages WHERE folder_id = ? AND uid = ?').get(folderId, uid)
  },
  idsInFolder(folderId: string): string[] { return (getDb().prepare('SELECT id FROM messages WHERE folder_id = ? ORDER BY date DESC LIMIT 5000').all(folderId) as any[]).map((r) => r.id) },
  uidsInFolder(folderId: string): number[] {
    return getDb().prepare('SELECT uid FROM messages WHERE folder_id = ?').all(folderId).map((r: any) => r.uid)
  },
  insert(m: Message): void {
    const db = getDb()
    db.prepare(`INSERT OR IGNORE INTO messages(id,account_id,folder_id,thread_id,uid,message_id,in_reply_to,references_json,
      from_json,to_json,cc_json,bcc_json,reply_to_json,subject,snippet,date,unread,starred,has_attachments,body_html,body_text,body_fetched)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      m.id, m.accountId, m.folderId, m.threadId, m.uid, m.messageId, m.inReplyTo, j(m.references),
      j(m.from), j(m.to), j(m.cc), j(m.bcc), j(m.replyTo), m.subject, m.snippet, m.date,
      m.unread ? 1 : 0, m.starred ? 1 : 0, m.hasAttachments ? 1 : 0, m.bodyHtml, m.bodyText, m.bodyFetched ? 1 : 0)
    const ins = db.prepare('INSERT OR IGNORE INTO attachments(id,message_id,filename,mime_type,size,content_id,inline,part_id,local_path) VALUES (?,?,?,?,?,?,?,?,?)')
    for (const a of m.attachments) ins.run(a.id, m.id, a.filename, a.mimeType, a.size, a.contentId, a.inline ? 1 : 0, a.partId, a.localPath)
    const folderText = ((db.prepare('SELECT path FROM folders WHERE id = ?').get(m.folderId) as any)?.path ?? '').replace(/[./]/g, ' ')
    db.prepare('INSERT INTO messages_fts(id, subject, from_text, to_text, body_text, folder_text, attachment_text) VALUES (?,?,?,?,?,?,?)')
      .run(m.id, m.subject, addrText([m.from]), addrText([...m.to, ...m.cc]), m.bodyText ?? m.snippet, folderText, '')
  },
  setBody(messageId: string, html: string | null, text: string | null): void {
    getDb().prepare('UPDATE messages SET body_html=?, body_text=?, body_fetched=1 WHERE id=?').run(html, text, messageId)
    if (text) getDb().prepare('UPDATE messages_fts SET body_text=? WHERE id=?').run(text, messageId)
  },
  setFlags(ids: string[], patch: { unread?: boolean; starred?: boolean }): void {
    const db = getDb()
    const sets: string[] = []
    const vals: number[] = []
    if (patch.unread !== undefined) { sets.push('unread=?'); vals.push(patch.unread ? 1 : 0) }
    if (patch.starred !== undefined) { sets.push('starred=?'); vals.push(patch.starred ? 1 : 0) }
    if (!sets.length) return
    const stmt = db.prepare(`UPDATE messages SET ${sets.join(',')} WHERE id=?`)
    for (const mid of ids) stmt.run(...vals, mid)
  },
  moveToFolder(ids: string[], folderId: string, uidMap: Record<string, number>): void {
    const db = getDb()
    const stmt = db.prepare('UPDATE messages SET folder_id=?, uid=? WHERE id=?')
    const folderText = ((db.prepare('SELECT path FROM folders WHERE id = ?').get(folderId) as any)?.path ?? '').replace(/[./]/g, ' ')
    const fts = db.prepare('UPDATE messages_fts SET folder_text=? WHERE id=?')
    const existing = db.prepare('SELECT id FROM messages WHERE folder_id=? AND uid=? AND id<>?')
    const del = db.prepare('DELETE FROM messages WHERE id=?')
    const delFts = db.prepare('DELETE FROM messages_fts WHERE id=?')
    const tx = db.transaction(() => {
      for (const mid of ids) {
        const uid = uidMap[mid] ?? 0
        // UID inconnu (serveur sans COPYUID) : on retire la copie locale, la synchro du dossier cible la recréera
        if (!uid) { del.run(mid); delFts.run(mid); continue }
        // la synchro du dossier cible a déjà inséré ce message sous son nouvel UID : on fusionne en gardant l'ancienne ligne (id stable)
        const dup = existing.get(folderId, uid, mid) as any
        if (dup) { del.run(dup.id); delFts.run(dup.id) }
        stmt.run(folderId, uid, mid); fts.run(folderText, mid)
      }
    })
    tx()
  },
  deleteByUids(folderId: string, uids: number[]): void {
    const db = getDb()
    const find = db.prepare('SELECT id FROM messages WHERE folder_id=? AND uid=?')
    const del = db.prepare('DELETE FROM messages WHERE id=?')
    const delFts = db.prepare('DELETE FROM messages_fts WHERE id=?')
    for (const u of uids) { const r = find.get(folderId, u) as any; if (r) { del.run(r.id); delFts.run(r.id) } }
  },
  delete(ids: string[]): void {
    const db = getDb()
    const del = db.prepare('DELETE FROM messages WHERE id=?')
    const delFts = db.prepare('DELETE FROM messages_fts WHERE id=?')
    for (const mid of ids) { del.run(mid); delFts.run(mid) }
  },
  headersByIds(ids: string[]): MessageHeader[] {
    if (!ids.length) return []
    const ph = ids.map(() => '?').join(',')
    return getDb().prepare(`SELECT * FROM messages WHERE id IN (${ph})`).all(...ids).map((r) => row(r, false))
  },
  // correction orthographique : terme du vocabulaire réel le plus fréquent à ≤ 2 lettres près
  nearestTerm(term: string): { term: string; doc: number } | null {
    const t = term.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (t.length < 4) return null
    let rows: { term: string; doc: number }[]
    try { rows = getDb().prepare('SELECT term, doc FROM messages_vocab WHERE length(term) BETWEEN ? AND ? AND substr(term, 1, 1) = ? AND doc >= 2').all(t.length - 2, t.length + 2, t[0]) as any[] } catch { return null }
    const dist = (a: string, b: string): number => { const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 3; let prev = Array.from({ length: n + 1 }, (_, i) => i); for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur } return prev[n] }
    let best: { term: string; doc: number; d: number } | null = null
    for (const r of rows) { if (r.term === t) return null; const d = dist(t, r.term); if (d === 0 || d > 2) continue; if (!best || d < best.d || (d === best.d && r.doc > best.doc)) best = { term: r.term, doc: r.doc, d } }
    // 1 lettre d'écart : accepté dès 2 messages ; 2 lettres : seulement pour un mot courant
    if (!best) return null
    if (best.d === 1 && best.doc >= 2) return { term: best.term, doc: best.doc }
    if (best.d === 2 && best.doc >= 15 && best.term.length >= 6) return { term: best.term, doc: best.doc }
    return null
  },
  searchIds(accountId: string | undefined, q: string, limit: number, byRelevance = false, order: 'desc' | 'asc' = 'desc'): string[] {
    const db = getDb()
    const terms = q.split(/\s+/).map((t) => t.replace(/[^\p{L}\p{N}@._-]/gu, '')).filter((t) => t.length > 0)
    if (!terms.length) return []
    const match = terms.map((t) => `"${t.replace(/"/g, '')}"*`).join(' AND ')
    const sql = `SELECT m.id FROM messages_fts f JOIN messages m ON m.id = f.id WHERE messages_fts MATCH ? ${accountId ? 'AND m.account_id = ?' : ''} ORDER BY ${byRelevance ? 'bm25(messages_fts, 0, 6, 3, 2, 1, 8, 1), m.date DESC' : `m.date ${order === 'asc' ? 'ASC' : 'DESC'}`} LIMIT ?`
    const args: unknown[] = [match]
    if (accountId) args.push(accountId)
    args.push(limit)
    try { return db.prepare(sql).all(...args).map((r: any) => r.id) } catch { return [] }
  },
  addLink(l: { accountId: string; parentMessageId: string; childMessageId: string; kind: 'reply' | 'forward'; to: Address[]; date: number }): void {
    getDb().prepare('INSERT INTO message_links(id,account_id,parent_message_id,child_message_id,kind,to_json,date) VALUES (?,?,?,?,?,?,?)')
      .run(crypto.randomUUID(), l.accountId, l.parentMessageId, l.childMessageId, l.kind, j(l.to), l.date)
  },
  linksForParents(accountId: string, parentMessageIds: string[]): { parentMessageId: string; childMessageId: string; kind: 'reply' | 'forward'; to: Address[]; date: number }[] {
    if (!parentMessageIds.length) return []
    const ph = parentMessageIds.map(() => '?').join(',')
    return getDb().prepare(`SELECT * FROM message_links WHERE account_id = ? AND parent_message_id IN (${ph}) ORDER BY date`).all(accountId, ...parentMessageIds)
      .map((r: any) => ({ parentMessageId: r.parent_message_id, childMessageId: r.child_message_id, kind: r.kind, to: p<Address[]>(r.to_json, []), date: r.date }))
  },
  linksForChildren(accountId: string, childMessageIds: string[]): { parentMessageId: string; childMessageId: string; kind: 'reply' | 'forward'; date: number }[] {
    if (!childMessageIds.length) return []
    const ph = childMessageIds.map(() => '?').join(',')
    return getDb().prepare(`SELECT * FROM message_links WHERE account_id = ? AND child_message_id IN (${ph})`).all(accountId, ...childMessageIds)
      .map((r: any) => ({ parentMessageId: r.parent_message_id, childMessageId: r.child_message_id, kind: r.kind, date: r.date }))
  }
}