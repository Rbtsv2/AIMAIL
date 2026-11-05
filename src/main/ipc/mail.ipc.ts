// src/main/ipc/mail.ipc.ts
import { handle } from './index'
import { parseQuery, hasFilter } from '@shared/search'
import { AccountRepo } from '../db/repositories/AccountRepo'
import { FolderRepo } from '../db/repositories/FolderRepo'
import { ThreadRepo } from '../db/repositories/ThreadRepo'
import { MessageRepo } from '../db/repositories/MessageRepo'
import { SettingsRepo } from '../db/repositories/SettingsRepo'
import { SyncManager } from '../sync/SyncManager'
import { AttachmentStore } from '../attachments/AttachmentStore'
import { sanitizeEmailHtml } from '../utils/sanitizeHtml'
import { events } from '../sync/events'
import { getDb } from '../db'
import { log } from '../utils/logger'
import type { FolderRole } from '@shared/models/Folder'
import type { MessageHeader } from '@shared/models/Message'

async function imap<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn() } catch (e: any) {
    const code = e?.serverResponseCode
    const text = String(e?.responseText ?? e?.message ?? e).replace(/\s*\([\d.]+ \+ [\d.]+ secs\)\.?$/, '')
    if (code === 'ALREADYEXISTS') throw new Error('Un dossier porte déjà ce nom.')
    if (code === 'NONEXISTENT') throw new Error('Ce dossier n’existe plus sur le serveur.')
    if (code === 'CANNOT') throw new Error(`Le serveur refuse cette opération : ${text}`)
    throw new Error(text)
  }
}

const AUTO_FOLDER: Partial<Record<FolderRole, string>> = { archive: 'Archive', spam: 'Junk', trash: 'Trash' }

export async function ensureRoleFolder(accountId: string, role: FolderRole) {
  const existing = FolderRepo.byRole(accountId, role)
  if (existing) return existing
  const name = AUTO_FOLDER[role]
  if (!name) return undefined
  const delimiter = FolderRepo.list(accountId)[0]?.delimiter ?? '/'
  const path = `${FolderRepo.rootPrefix(accountId, delimiter)}${name}`
  const engine = SyncManager.engine(accountId)
  try { await engine.createMailbox(path) } catch (e: any) { if (!/ALREADYEXISTS|exists/i.test(String(e?.message ?? e))) throw e }
  await engine.listFolders()
  let f = FolderRepo.list(accountId).find((x) => x.path === path)
  if (f && f.role !== role) { FolderRepo.upsert({ ...f, role }); f = FolderRepo.get(f.id) }
  events.emitEvent('mail:changed', { accountId })
  return f
}

function groupByFolder(headers: MessageHeader[]): Map<string, MessageHeader[]> {
  const m = new Map<string, MessageHeader[]>()
  for (const h of headers) { const arr = m.get(h.folderId) ?? []; arr.push(h); m.set(h.folderId, arr) }
  return m
}

export function registerMailIpc(): void {
  handle('folders:list', (accountId) => FolderRepo.list(accountId))
  handle('folders:create', async (accountId, name, parentFolderId) => {
    const parent = parentFolderId ? FolderRepo.get(parentFolderId) : undefined
    const delimiter = parent?.delimiter ?? FolderRepo.list(accountId)[0]?.delimiter ?? '/'
    const clean = name.trim().replace(new RegExp(delimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '-')
    if (!clean) throw new Error('nom vide')
    const path = parent ? `${parent.path}${delimiter}${clean}` : `${FolderRepo.rootPrefix(accountId, delimiter)}${clean}`
    const engine = SyncManager.engine(accountId)
    await imap(() => engine.createMailbox(path))
    await engine.listFolders()
    events.emitEvent('mail:changed', { accountId })
    const f = FolderRepo.list(accountId).find((x) => x.path === path)
    if (!f) throw new Error('dossier créé mais introuvable')
    return f
  })
  handle('folders:rename', async (folderId, name) => {
    const f = FolderRepo.get(folderId)
    if (!f) throw new Error('dossier introuvable')
    if (f.role !== 'custom') throw new Error('ce dossier système ne peut pas être renommé')
    const clean = name.trim().split(f.delimiter).join('-')
    const parentPath = f.path.includes(f.delimiter) ? f.path.slice(0, f.path.lastIndexOf(f.delimiter) + 1) : ''
    const newPath = parentPath + clean
    if (!clean || newPath === f.path) return f
    await imap(() => SyncManager.engine(f.accountId).renameMailbox(f.path, newPath))
    FolderRepo.renamePaths(f.accountId, f.path, newPath, f.delimiter)
    await SyncManager.engine(f.accountId).listFolders()
    events.emitEvent('mail:changed', { accountId: f.accountId })
    return FolderRepo.get(folderId)!
  })
  handle('folders:move', async (folderId, newParentFolderId) => {
    const f = FolderRepo.get(folderId)
    if (!f) throw new Error('dossier introuvable')
    if (f.role !== 'custom') throw new Error('ce dossier système ne peut pas être déplacé')
    const parent = newParentFolderId ? FolderRepo.get(newParentFolderId) : undefined
    if (parent && (parent.id === f.id || parent.path.startsWith(f.path + f.delimiter))) throw new Error('impossible de déplacer un dossier dans lui-même')
    const leaf = f.path.split(f.delimiter).pop()!
    const newPath = parent ? `${parent.path}${f.delimiter}${leaf}` : `${FolderRepo.rootPrefix(f.accountId, f.delimiter)}${leaf}`
    if (newPath === f.path) return f
    await imap(() => SyncManager.engine(f.accountId).renameMailbox(f.path, newPath))
    FolderRepo.renamePaths(f.accountId, f.path, newPath, f.delimiter)
    await SyncManager.engine(f.accountId).listFolders()
    events.emitEvent('mail:changed', { accountId: f.accountId })
    return FolderRepo.get(folderId)!
  })
  handle('folders:delete', async (folderId) => {
    const f = FolderRepo.get(folderId)
    if (!f) return
    if (f.role !== 'custom') throw new Error('ce dossier système ne peut pas être supprimé')
    await imap(() => SyncManager.engine(f.accountId).deleteMailbox(f.path))
    await SyncManager.engine(f.accountId).listFolders()
    events.emitEvent('mail:changed', { accountId: f.accountId })
  })
  handle('folders:info', (folderId) => {
    const f = FolderRepo.get(folderId)
    if (!f) return { total: 0, subfolders: 0 }
    const total = (getDb().prepare('SELECT COUNT(*) AS n FROM messages WHERE folder_id = ?').get(folderId) as any).n as number
    const subfolders = FolderRepo.list(f.accountId).filter((x) => x.path.startsWith(f.path + f.delimiter)).length
    return { total: Math.max(total, f.total), subfolders }
  })
  // suppression d'un dossier non vide : son contenu part dans la Corbeille, puis le dossier est supprimé sur le serveur
  handle('folders:deleteWithContents', async (folderId) => {
    const f = FolderRepo.get(folderId)
    if (!f) return { moved: 0 }
    if (f.role !== 'custom') throw new Error('ce dossier système ne peut pas être supprimé')
    const engine = SyncManager.engine(f.accountId)
    const subs = FolderRepo.list(f.accountId).filter((x) => x.path.startsWith(f.path + f.delimiter)).sort((a, b) => b.path.length - a.path.length)
    const trash = await ensureRoleFolder(f.accountId, 'trash')
    if (!trash) throw new Error('aucune Corbeille sur ce compte')
    let moved = 0
    for (const folder of [...subs, f]) {
      await engine.syncFolder(folder, { limit: Infinity })
      const uids = MessageRepo.uidsInFolder(folder.id)
      if (uids.length) {
        const uidMap = await engine.move(folder, uids, trash)
        const ids = uids.map((u) => MessageRepo.byUid(folder.id, u)?.id).filter((x): x is string => !!x)
        const byId: Record<string, number> = {}; for (const u of uids) { const m = MessageRepo.byUid(folder.id, u); if (m) byId[m.id] = uidMap[u] ?? 0 }
        MessageRepo.moveToFolder(ids, trash.id, byId)
        moved += uids.length
      }
      await imap(() => engine.deleteMailbox(folder.path))
    }
    await engine.listFolders()
    FolderRepo.recount(trash.id)
    events.emitEvent('mail:changed', { accountId: f.accountId })
    return { moved }
  })
  handle('folders:reorder', (orderedIds) => { FolderRepo.reorder(orderedIds) })
  handle('folders:empty', async (folderId) => {
    const f = FolderRepo.get(folderId)
    if (!f) throw new Error('dossier introuvable')
    if (f.role !== 'trash' && f.role !== 'spam') throw new Error('seuls Corbeille et Indésirables peuvent être vidés')
    const uids = MessageRepo.uidsInFolder(f.id)
    const ids = uids.map((u) => MessageRepo.byUid(f.id, u)?.id).filter(Boolean) as string[]
    const threadIds = ThreadRepo.threadIdsForMessages(ids)
    if (uids.length) await SyncManager.engine(f.accountId).delete(f, uids)
    MessageRepo.delete(ids)
    for (const t of threadIds) ThreadRepo.recompute(t)
    FolderRepo.recount(f.id)
    events.emitEvent('mail:changed', { accountId: f.accountId, threadIds })
    return uids.length
  })
  handle('messages:moveToFolder', async (ids, folderId) => {
    const headers = MessageRepo.headersByIds(ids)
    const target = FolderRepo.get(folderId)
    if (!target) throw new Error('dossier introuvable')
    if (target.noselect) throw new Error('ce dossier ne peut pas contenir de messages')
    const threadIds = ThreadRepo.threadIdsForMessages(ids)
    for (const [fromId, hs] of groupByFolder(headers)) {
      if (fromId === target.id) continue
      const from = FolderRepo.get(fromId)!
      const uidMap = await SyncManager.engine(hs[0].accountId).move(from, hs.map((h) => h.uid), target)
      const byId: Record<string, number> = {}
      for (const h of hs) byId[h.id] = uidMap[h.uid] ?? 0
      MessageRepo.moveToFolder(hs.map((h) => h.id), target.id, byId)
      FolderRepo.recount(from.id); FolderRepo.recount(target.id)
    }
    for (const t of threadIds) ThreadRepo.recompute(t)
    events.emitEvent('mail:changed', { accountId: headers[0]?.accountId ?? '', threadIds })
  })
  handle('threads:list', (q) => {
    const parsed = parseQuery(q.search ?? '')
    const filter = { ...(q.filter ?? {}), ...parsed.filter }
    if (parsed.text) {
      const ids = MessageRepo.searchIds(q.accountId, parsed.text, 400)
      return ThreadRepo.list({ accountId: q.accountId, ids: [...new Set(ThreadRepo.threadIdsForMessages(ids))], filter, limit: q.limit, offset: q.offset })
    }
    // opérateurs seuls (de:, pj, …) : recherche dans toute la boîte ou le dossier courant si rien n'est saisi d'autre
    return ThreadRepo.list({ accountId: q.accountId, folderId: hasFilter(parsed.filter) ? undefined : q.folderId, role: hasFilter(parsed.filter) ? undefined : q.role, filter, limit: q.limit, offset: q.offset })
  })
  handle('threads:messageIds', (threadIds) => threadIds.flatMap((t) => MessageRepo.byThread(t).map((m) => m.id)))
  handle('threads:get', (threadId) => {
    const thread = ThreadRepo.get(threadId)
    if (!thread) throw new Error('fil introuvable')
    const messages = MessageRepo.byThread(threadId).map((m) => ({ ...m, bodyHtml: null, bodyText: null }))
    const inThread = new Set(messages.map((m) => m.messageId))
    const events = MessageRepo.linksForParents(thread.accountId, messages.map((m) => m.messageId))
      .filter((l) => !inThread.has(l.childMessageId))
      .map((l) => {
        const child = MessageRepo.byMessageId(thread.accountId, l.childMessageId)
        return { kind: l.kind, parentMessageId: l.parentMessageId, childMessageId: l.childMessageId, childThreadId: child?.threadId ?? null, childSubject: child?.subject ?? '', to: l.to, date: l.date }
      })
    return { thread, messages, events }
  })
  handle('messages:body', async (messageId) => {
    const m = MessageRepo.get(messageId)
    if (!m) throw new Error('message introuvable')
    const needsRefetch = m.bodyFetched && !!m.bodyHtml && /src=["']cid:/i.test(m.bodyHtml) && !m.attachments.some((a) => a.contentId)
    if (!m.bodyFetched || needsRefetch) {
      const b = await SyncManager.engine(m.accountId).fetchBody(m)
      m.bodyHtml = b.html; m.bodyText = b.text; m.bodyFetched = true
      m.attachments = MessageRepo.attachments(m.id)
    }
    if (m.bodyHtml) {
      const cidMap = await AttachmentStore.inlineDataUrls(m.id)
      const srcs = [...m.bodyHtml.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((x) => x[1])
      log.info('images', `${m.subject} — pièces avec Content-ID : [${MessageRepo.attachments(m.id).map((a) => `${a.contentId ?? '∅'} (${a.mimeType}, part ${a.partId})`).join(', ')}]`)
      for (const src of srcs) {
        if (src.startsWith('cid:')) { const k = decodeURIComponent(src.slice(4)).replace(/[<>]/g, ''); log.info('images', cidMap[k] ? `  embarquée OK  ${k}` : `  embarquée INTROUVABLE  ${k}`) }
        else log.info('images', `  ${src.startsWith('data:') ? 'data' : 'distante'}  ${src.slice(0, 120)}`)
      }
      m.bodyHtml = sanitizeEmailHtml(m.bodyHtml, { loadRemoteImages: SettingsRepo.app().loadRemoteImages, cidMap })
    }
    return m
  })
  handle('messages:flag', async (ids, patch) => {
    const headers = MessageRepo.headersByIds(ids)
    MessageRepo.setFlags(ids, patch)
    const threadIds = ThreadRepo.threadIdsForMessages(ids)
    for (const t of threadIds) ThreadRepo.recompute(t)
    for (const [folderId, hs] of groupByFolder(headers)) {
      FolderRepo.recount(folderId)
      const folder = FolderRepo.get(folderId)!
      SyncManager.engine(hs[0].accountId).setFlags(folder, hs.map((h) => h.uid), patch).catch(() => {})
    }
    events.emitEvent('mail:changed', { accountId: headers[0]?.accountId ?? '', threadIds })
  })
  handle('blocked:list', () => getDb().prepare('SELECT address, created_at FROM blocked_senders ORDER BY created_at DESC').all().map((r: any) => ({ address: r.address, createdAt: r.created_at })))
  handle('blocked:add', (addresses) => { const st = getDb().prepare('INSERT OR IGNORE INTO blocked_senders(address, created_at) VALUES (?, ?)'); for (const a of addresses) if (a) st.run(a.toLowerCase(), Date.now()) })
  handle('blocked:remove', (address) => { getDb().prepare('DELETE FROM blocked_senders WHERE address = ?').run(address.toLowerCase()) })
  handle('messages:move', async (ids, role) => {
    // apprentissage : signaler comme indésirable bloque l'expéditeur ; « pas indésirable » le débloque
    const own = new Set(AccountRepo.list().map((a) => a.email.toLowerCase()))
    const senders = [...new Set(ids.map((id) => MessageRepo.get(id)?.from.address.toLowerCase()).filter((x): x is string => !!x && !own.has(x)))]
    if (role === 'spam') { const st = getDb().prepare('INSERT OR IGNORE INTO blocked_senders(address, created_at) VALUES (?, ?)'); for (const a of senders) st.run(a, Date.now()) }
    else if (role === 'inbox') { const st = getDb().prepare('DELETE FROM blocked_senders WHERE address = ?'); for (const a of senders) st.run(a) }
    const headers = MessageRepo.headersByIds(ids)
    const threadIds = ThreadRepo.threadIdsForMessages(ids)
    for (const [folderId, hs] of groupByFolder(headers)) {
      const from = FolderRepo.get(folderId)!
      const target = await ensureRoleFolder(hs[0].accountId, role as FolderRole)
      if (!target) throw new Error(`aucun dossier « ${role} » sur ce compte`)
      if (target.id === from.id) continue
      const uidMap = await SyncManager.engine(hs[0].accountId).move(from, hs.map((h) => h.uid), target)
      const byId: Record<string, number> = {}
      for (const h of hs) byId[h.id] = uidMap[h.uid] ?? 0
      MessageRepo.moveToFolder(hs.map((h) => h.id), target.id, byId)
      FolderRepo.recount(from.id); FolderRepo.recount(target.id)
    }
    for (const t of threadIds) ThreadRepo.recompute(t)
    events.emitEvent('mail:changed', { accountId: headers[0]?.accountId ?? '', threadIds })
  })
  handle('messages:delete', async (ids) => {
    const headers = MessageRepo.headersByIds(ids)
    const threadIds = ThreadRepo.threadIdsForMessages(ids)
    for (const [folderId, hs] of groupByFolder(headers)) {
      const folder = FolderRepo.get(folderId)!
      await SyncManager.engine(hs[0].accountId).delete(folder, hs.map((h) => h.uid))
      MessageRepo.delete(hs.map((h) => h.id))
      FolderRepo.recount(folderId)
    }
    for (const t of threadIds) ThreadRepo.recompute(t)
    events.emitEvent('mail:changed', { accountId: headers[0]?.accountId ?? '', threadIds })
  })
  handle('attachments:open', (id) => AttachmentStore.open(id))
  handle('attachments:save', (id) => AttachmentStore.save(id))
  handle('sync:now', (accountId) => SyncManager.syncNow(accountId))
  handle('sync:reset', async (accountId) => {
    const db = getDb()
    db.prepare('DELETE FROM messages_fts WHERE id IN (SELECT id FROM messages WHERE account_id = ?)').run(accountId)
    db.prepare('DELETE FROM messages WHERE account_id = ?').run(accountId)
    db.prepare('DELETE FROM threads WHERE account_id = ?').run(accountId)
    db.prepare('DELETE FROM folders WHERE account_id = ?').run(accountId)
    events.emitEvent('mail:changed', { accountId })
    await SyncManager.syncNow(accountId)
  })
  handle('sync:status', () => SyncManager.statuses())
}