// src/main/sync/ImapSyncEngine.ts
import { ImapFlow, type FetchMessageObject } from 'imapflow'
import type { Account } from '@shared/models/Account'
import type { Folder, FolderRole } from '@shared/models/Folder'
import type { Message } from '@shared/models/Message'
import type { SyncEngine } from './SyncEngine'
import { resolveAuth } from '../auth'
import { FolderRepo } from '../db/repositories/FolderRepo'
import { MessageRepo } from '../db/repositories/MessageRepo'
import { ThreadRepo } from '../db/repositories/ThreadRepo'
import { resolveThreadId } from './Threader'
import { snippetOf, parseRaw } from './MessageParser'
import type { Address } from '@shared/models/Message'
import { id } from '../db'
import { log } from '../utils/logger'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, writeFileSync } from 'fs'
import { extractText, EXTRACTABLE } from '../attachments/extract'
import { INITIAL_SYNC_LIMIT } from '@shared/constants'
import { Classifier } from '../ai/Classifier'
import { ContactRepo } from '../db/repositories/ContactRepo'
import { getDb } from '../db'
import { ensureRoleFolder } from '../ipc/mail.ipc'
import { AccountRepo } from '../db/repositories/AccountRepo'
import { SettingsRepo } from '../db/repositories/SettingsRepo'

const ROLE_BY_SPECIAL: Record<string, FolderRole> = {
  '\\Inbox': 'inbox', '\\Sent': 'sent', '\\Drafts': 'drafts', '\\Trash': 'trash', '\\Junk': 'spam', '\\Archive': 'archive', '\\Flagged': 'starred', '\\All': 'all'
}

function guessRole(path: string, special?: string): FolderRole {
  if (special && ROLE_BY_SPECIAL[special]) return ROLE_BY_SPECIAL[special]
  const p = path.toLowerCase()
  if (p === 'inbox') return 'inbox'
  if (/sent|envoy/.test(p)) return 'sent'
  if (/draft|brouillon/.test(p)) return 'drafts'
  if (/trash|deleted|corbeille/.test(p)) return 'trash'
  if (/spam|junk|ind[ée]sirable/.test(p)) return 'spam'
  if (/archive/.test(p)) return 'archive'
  return 'custom'
}

export class ImapSyncEngine implements SyncEngine {
  private client: ImapFlow | null = null
  constructor(private account: Account) {}

  private async getClient(): Promise<ImapFlow> {
    if (this.client?.usable) return this.client
    const auth = await resolveAuth(this.account)
    this.client = new ImapFlow({
      host: this.account.imap.host, port: this.account.imap.port, secure: this.account.imap.secure,
      auth: auth.accessToken ? { user: auth.user, accessToken: auth.accessToken } : { user: auth.user, pass: auth.pass ?? '' },
      logger: false, emitLogs: false,
      connectionTimeout: 20_000, greetingTimeout: 15_000, socketTimeout: 5 * 60_000
    })
    this.client.on('error', (e) => log.warn('imap', this.account.email, e.message))
    await this.client.connect()
    return this.client
  }

  async connect(): Promise<void> { await this.getClient() }
  async disconnect(): Promise<void> { try { await this.client?.logout() } catch {} this.client = null }

  async listFolders(): Promise<Folder[]> {
    const c = await this.getClient()
    const boxes = await c.list()
    // priorité : dossier marqué par le serveur (SPECIAL-USE), puis chemin le plus court
    boxes.sort((a, b) => Number(!!b.specialUse) - Number(!!a.specialUse) || a.path.length - b.path.length)
    const used = new Set<FolderRole>()
    const paths: string[] = []
    const out: Folder[] = []
    for (const b of boxes) {
      const noselect = b.flags.has('\\Noselect')
      let role = noselect ? 'custom' as FolderRole : guessRole(b.path, b.specialUse)
      if (role !== 'custom' && used.has(role)) role = 'custom'
      if (role !== 'custom') used.add(role)
      paths.push(b.path)
      out.push(FolderRepo.upsert({
        accountId: this.account.id, path: b.path, name: b.name, delimiter: b.delimiter ?? '/',
        role, uidValidity: 0, uidNext: 0, noselect
      }))
    }
    FolderRepo.removeMissing(this.account.id, paths)
    return out
  }

  async syncFolder(folder: Folder, opts: { limit?: number } = {}): Promise<void> {
    const c = await this.getClient()
    const lock = await c.getMailboxLock(folder.path)
    try {
      const mb = c.mailbox
      if (!mb) return
      if (folder.uidValidity && mb.uidValidity !== BigInt(folder.uidValidity)) FolderRepo.resetFolder(folder.id)
      const limit = opts.limit ?? INITIAL_SYNC_LIMIT
      const allUids = (((await c.search({ all: true }, { uid: true })) || []) as number[]).sort((a, b) => a - b)
      const serverUids = Number.isFinite(limit) ? allUids.slice(-limit) : allUids
      const serverSet = new Set(serverUids)
      const touched = new Set<string>()

      const gone = MessageRepo.uidsInFolder(folder.id).filter((u) => !serverSet.has(u))
      if (gone.length) {
        for (const u of gone) { const r = MessageRepo.byUid(folder.id, u); if (r) touched.add(r.threadId) }
        MessageRepo.deleteByUids(folder.id, gone)
      }

      const missing = serverUids.filter((u) => !MessageRepo.existsUid(folder.id, u))
      const inserted: string[] = []
      log.info('sync', `${this.account.email} ${folder.path} (${folder.role}) : ${serverUids.length} sur le serveur, ${missing.length} nouveaux, ${gone.length} supprimés`)
      for (let i = 0; i < missing.length; i += 50) {
        const batch = missing.slice(i, i + 50)
        for await (const msg of c.fetch(batch, { uid: true, envelope: true, flags: true, bodyStructure: true, internalDate: true, size: true }, { uid: true })) {
          const m = this.toMessage(folder, msg)
          ThreadRepo.ensure(m.threadId, this.account.id, m.subject, m.date)
          MessageRepo.insert(m)
          touched.add(m.threadId)
          inserted.push(m.id)
        }
      }
      // expéditeurs bloqués : déplacement immédiat vers Indésirables (serveur + local)
      if (folder.role === 'inbox' && inserted.length) {
        const blocked = new Set((getDb().prepare('SELECT address FROM blocked_senders').all() as any[]).map((r) => r.address))
        if (blocked.size) {
          const hit = inserted.map((mid) => MessageRepo.get(mid)).filter((m): m is NonNullable<typeof m> => !!m && blocked.has(m.from.address.toLowerCase()))
          if (hit.length) {
            try {
              const spam = await ensureRoleFolder(this.account.id, 'spam')
              if (spam) {
                const uidMap = await this.move(folder, hit.map((m) => m.uid), spam)
                const byId: Record<string, number> = {}; for (const m of hit) byId[m.id] = uidMap[m.uid] ?? 0
                MessageRepo.moveToFolder(hit.map((m) => m.id), spam.id, byId)
                FolderRepo.recount(spam.id)
                for (const m of hit) { const i = inserted.indexOf(m.id); if (i >= 0) inserted.splice(i, 1) }
                log.info('spam', `${hit.length} message(s) d'expéditeur bloqué déplacé(s) dans Indésirables`)
              }
            } catch (e: any) { log.warn('spam', e?.message) }
          }
        }
      }
      if (folder.role === 'inbox' && inserted.length) Classifier.enqueueMany(inserted.slice(-30))
      if (inserted.length && SettingsRepo.app().collectAddresses !== false && folder.role !== 'spam' && folder.role !== 'trash') {
        const own = new Set(AccountRepo.list().map((a) => a.email.toLowerCase()))
        const addrs = inserted.flatMap((mid) => { const m = MessageRepo.get(mid); return m ? [m.from, ...m.to, ...m.cc] : [] })
        try { ContactRepo.harvestAddresses(addrs, own) } catch (e: any) { log.warn('contacts', e?.message) }
      }

      if (serverUids.length) for await (const msg of c.fetch(serverUids, { uid: true, flags: true }, { uid: true })) {
        const flags = msg.flags ?? new Set<string>()
        const unread = !flags.has('\\Seen')
        const starred = flags.has('\\Flagged')
        const row = MessageRepo.byUid(folder.id, msg.uid)
        if (row && (row.unread !== unread || row.starred !== starred)) {
          MessageRepo.setFlags([row.id], { unread, starred })
          touched.add(row.threadId)
        }
      }

      for (const t of touched) ThreadRepo.recompute(t)
      FolderRepo.recount(folder.id)
      FolderRepo.setUidState(folder.id, Number(mb.uidValidity), Number(mb.uidNext))
    } finally { lock.release() }
  }

  private toMessage(folder: Folder, msg: FetchMessageObject): Message {
    const env = msg.envelope!
    const from = imapAddresses(env.from as any)[0] ?? { name: '', address: '' }
    const refs = (env as any).references ? String((env as any).references).split(/\s+/).filter(Boolean) : []
    const inReplyTo = env.inReplyTo ?? null
    const subject = env.subject ?? '(sans objet)'
    const threadId = resolveThreadId(this.account.id, { messageId: env.messageId ?? `uid-${msg.uid}@${folder.id}`, inReplyTo, references: refs, subject },
      { byMessageId: (mid) => MessageRepo.byMessageId(this.account.id, mid) })
    const atts = collectAttachments(msg.bodyStructure)
    return {
      id: id(), accountId: this.account.id, folderId: folder.id, threadId, uid: msg.uid,
      messageId: env.messageId ?? `uid-${msg.uid}@${folder.id}`, inReplyTo, references: refs,
      from, to: imapAddresses(env.to as any), cc: imapAddresses(env.cc as any), bcc: imapAddresses(env.bcc as any), replyTo: imapAddresses(env.replyTo as any),
      subject, snippet: '', date: new Date(msg.internalDate ?? env.date ?? Date.now()).getTime(),
      unread: !(msg.flags ?? new Set()).has('\\Seen'), starred: (msg.flags ?? new Set()).has('\\Flagged'), hasAttachments: atts.some((a) => !a.inline),
      bodyHtml: null, bodyText: null, bodyFetched: false, category: null,
      attachments: atts.map((a) => ({ ...a, id: id(), messageId: '', localPath: null }))
    }
  }

  async fetchBody(message: Message): Promise<{ html: string | null; text: string | null }> {
    const c = await this.getClient()
    const folder = FolderRepo.get(message.folderId)!
    const lock = await c.getMailboxLock(folder.path)
    try {
      const dl = await c.download(String(message.uid), undefined, { uid: true })
      const chunks: Buffer[] = []
      for await (const ch of dl.content) chunks.push(ch as Buffer)
      const parsed = await parseRaw(Buffer.concat(chunks))
      MessageRepo.setBody(message.id, parsed.html, parsed.text)
      const dir = join(app.getPath('userData'), 'attachments')
      mkdirSync(dir, { recursive: true })
      const saved = parsed.attachments.map((a) => {
        const aid = id()
        const safe = a.filename.replace(/[\\/:*?"<>|]/g, '_')
        const path = join(dir, `${aid}-${safe}`)
        writeFileSync(path, a.content)
        return { id: aid, messageId: message.id, filename: a.filename, mimeType: a.mimeType, size: a.size, contentId: a.contentId, inline: a.inline, partId: '', localPath: path }
      })
      MessageRepo.replaceAttachments(message.id, saved)
      // extraction du texte des pièces jointes (PDF, Word, texte…) pour la recherche et l'assistant
      for (const a of saved) {
        if (a.inline || !a.localPath || !(EXTRACTABLE.test(a.filename) || /pdf|wordprocessingml|text\/|message\/rfc822/.test(a.mimeType)) || a.size > 15_000_000) continue
        try { const t = await extractText(a.localPath, a.mimeType); if (t) MessageRepo.setAttachmentText(a.id, t) } catch (e: any) { log.warn('attachments', a.filename, e?.message) }
      }
      MessageRepo.setSnippet(message.id, snippetOf(parsed.html, parsed.text))
      ThreadRepo.recompute(message.threadId)
      return { html: parsed.html, text: parsed.text }
    } finally { lock.release() }
  }

  async fetchAttachment(message: Message, partId: string): Promise<Buffer> {
    const c = await this.getClient()
    const folder = FolderRepo.get(message.folderId)!
    const lock = await c.getMailboxLock(folder.path)
    try {
      const dl = await c.download(String(message.uid), partId, { uid: true })
      const chunks: Buffer[] = []
      for await (const ch of dl.content) chunks.push(ch as Buffer)
      return Buffer.concat(chunks)
    } finally { lock.release() }
  }

  async setFlags(folder: Folder, uids: number[], patch: { unread?: boolean; starred?: boolean }): Promise<void> {
    const c = await this.getClient()
    const lock = await c.getMailboxLock(folder.path)
    try {
      if (patch.unread === true) await c.messageFlagsRemove(uids, ['\\Seen'], { uid: true })
      if (patch.unread === false) await c.messageFlagsAdd(uids, ['\\Seen'], { uid: true })
      if (patch.starred === true) await c.messageFlagsAdd(uids, ['\\Flagged'], { uid: true })
      if (patch.starred === false) await c.messageFlagsRemove(uids, ['\\Flagged'], { uid: true })
    } finally { lock.release() }
  }

  async move(folder: Folder, uids: number[], target: Folder): Promise<Record<number, number>> {
    const c = await this.getClient()
    const lock = await c.getMailboxLock(folder.path)
    try {
      const r = await c.messageMove(uids, target.path, { uid: true })
      const map: Record<number, number> = {}
      if (r && r.uidMap) for (const [k, v] of r.uidMap) map[k] = v
      return map
    } finally { lock.release() }
  }

  async delete(folder: Folder, uids: number[]): Promise<void> {
    const c = await this.getClient()
    const lock = await c.getMailboxLock(folder.path)
    try { await c.messageDelete(uids, { uid: true }) } finally { lock.release() }
  }

  async append(folder: Folder, raw: Buffer, flags: string[]): Promise<number | null> {
    const c = await this.getClient()
    const r = await c.append(folder.path, raw, flags)
    return r && typeof r === 'object' && 'uid' in r && r.uid ? Number(r.uid) : null
  }

  async createMailbox(path: string): Promise<void> {
    const c = await this.getClient()
    await c.mailboxCreate(path)
    try { await c.mailboxSubscribe(path) } catch {}
  }
  async renameMailbox(oldPath: string, newPath: string): Promise<void> {
    const c = await this.getClient()
    await c.mailboxRename(oldPath, newPath)
    try { await c.mailboxSubscribe(newPath) } catch {}
  }
  async deleteMailbox(path: string): Promise<void> {
    const c = await this.getClient()
    await c.mailboxDelete(path)
  }

  private idleClient: ImapFlow | null = null

  async idle(folder: Folder, onChange: () => void): Promise<() => void> {
    let stopped = false
    const start = async (): Promise<void> => {
      if (stopped) return
      const auth = await resolveAuth(this.account)
      const c = new ImapFlow({
        host: this.account.imap.host, port: this.account.imap.port, secure: this.account.imap.secure,
        auth: auth.accessToken ? { user: auth.user, accessToken: auth.accessToken } : { user: auth.user, pass: auth.pass ?? '' },
        logger: false, emitLogs: false
      })
      this.idleClient = c
      c.on('error', (e) => log.warn('idle', this.account.email, e.message))
      c.on('close', () => { if (!stopped) setTimeout(() => void start(), 5000) })
      await c.connect()
      await c.mailboxOpen(folder.path)
      const handler = () => onChange()
      c.on('exists', handler); c.on('expunge', handler); c.on('flags', handler)
      log.info('idle', `${this.account.email} écoute ${folder.path}`)
      while (!stopped && c.usable) {
        try { await c.idle() } catch { break }
      }
    }
    void start().catch((e) => { log.warn('idle', this.account.email, e?.message ?? e); if (!stopped) setTimeout(() => void start(), 15000) })
    return () => { stopped = true; try { void this.idleClient?.logout() } catch {} this.idleClient = null }
  }

  async disconnectAll(): Promise<void> {
    await this.disconnect()
    try { await this.idleClient?.logout() } catch {}
    this.idleClient = null
  }
}

const imapAddresses = (list?: { name?: string; address?: string }[] | null): Address[] =>
  (list ?? []).filter((a) => a && a.address).map((a) => ({ name: a.name ?? '', address: a.address ?? '' }))

function collectAttachments(bs: any, out: { filename: string; mimeType: string; size: number; contentId: string | null; inline: boolean; partId: string }[] = []): typeof out {
  if (!bs) return out
  if (bs.childNodes) for (const ch of bs.childNodes) collectAttachments(ch, out)
  const disp = (bs.disposition ?? '').toLowerCase()
  const name = bs.dispositionParameters?.filename ?? bs.parameters?.name
  const isImage = typeof bs.type === 'string' && bs.type.startsWith('image/')
  const hasCid = !!bs.id
  if (disp === 'attachment' || hasCid || (name && bs.type !== 'text/plain' && bs.type !== 'text/html') || (isImage && !bs.childNodes)) {
    out.push({ filename: name ?? (isImage ? 'image' : 'piece-jointe'), mimeType: bs.type ?? 'application/octet-stream', size: bs.size ?? 0,
      contentId: hasCid ? String(bs.id).replace(/[<>]/g, '') : null, inline: hasCid && disp !== 'attachment', partId: bs.part ?? '1' })
  }
  return out
}