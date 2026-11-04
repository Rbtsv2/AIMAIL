// src/renderer/src/stores/compose.store.ts
import { create } from 'zustand'
import type { Draft } from '@shared/models/Draft'
import type { Message } from '@shared/models/Message'
import type { OutboxItem } from '@shared/models/Draft'
import { invoke } from '@/lib/api'
import { useAccounts } from './accounts.store'
import { useUi } from './ui.store'
import { useMail } from './mail.store'
import type { Address } from '@shared/models/Message'
import { useSettings } from './settings.store'

export const isComposeWindow = (): boolean => window.location.hash.startsWith('#compose=')
export const composeDraftId = (): string | null => isComposeWindow() ? window.location.hash.slice('#compose='.length) : null

async function detach(d: Draft): Promise<void> {
  await invoke('drafts:save', d)
  await invoke('compose:open', d.id)
}

interface S {
  draft: Draft | null
  sent: boolean
  outbox: Record<string, OutboxItem>
  openNew(accountId?: string): void
  buildReply(msg: Message, mode: 'reply' | 'replyAll' | 'forward', threadId: string): Promise<Draft | null>
  openReply(msg: Message, mode: 'reply' | 'replyAll' | 'forward', threadId: string): void
  sendDirect(d: Draft): Promise<void>
  openDraft(d: Draft): void
  resumeMessage(messageId: string): Promise<void>
  update(patch: Partial<Draft>): void
  close(): Promise<void>
  send(): Promise<void>
  onOutbox(item: OutboxItem): void
}

const quote = (m: Message): string => {
  const who = `${m.from.name || m.from.address} <${m.from.address}>`
  const when = new Date(m.date).toLocaleString('fr-FR')
  const body = m.bodyHtml ?? `<pre>${(m.bodyText ?? '').replace(/</g, '&lt;')}</pre>`
  return `<p></p><p></p><div style="color:#6e6e73;font-size:13px">Le ${when}, ${who.replace(/</g, '&lt;')} a écrit :</div><blockquote style="border-left:2px solid #c7c7cc;margin:8px 0;padding-left:12px;color:#6e6e73">${body}</blockquote>`
}

export const useCompose = create<S>((set, get) => ({
  draft: null, sent: false, outbox: {},
  openNew: (accountId) => {
    const acc = useAccounts.getState().accounts
    const a = acc.find((x) => x.id === accountId) ?? acc[0]
    if (!a) return
    const d: Draft = { id: crypto.randomUUID(), accountId: a.id, threadId: null, replyToMessageId: null, forwardOfMessageId: null, mode: 'new', to: [], cc: [], bcc: [], subject: '', html: '', text: '', signatureId: a.defaultSignatureId, attachmentPaths: [], imapFolderId: null, imapUid: null, updatedAt: Date.now() }
    if (isComposeWindow()) set({ draft: d }); else void detach(d)
  },
  buildReply: async (m0, mode, threadId) => {
    const a = useAccounts.getState().accounts.find((x) => x.id === m0.accountId)
    if (!a) return null
    let m = m0
    if (!m.bodyHtml && !m.bodyText) { try { m = await invoke('messages:body', m0.id) } catch {} }
    const self = a.email.toLowerCase()
    const mine = (x: { address: string }) => x.address.toLowerCase() === self
    const notMe = (x: { address: string }) => !mine(x)
    // base des destinataires : le dernier message du fil qui n'est pas de moi
    const thread = useMail.getState().current
    const inThread = thread && thread.thread.id === threadId ? thread.messages : [m]
    const lastReceived = [...inThread].reverse().find((x) => notMe(x.from)) ?? (notMe(m.from) ? m : null)
    let replyTo: Address[]
    if (lastReceived) replyTo = lastReceived.replyTo.length ? lastReceived.replyTo : [lastReceived.from]
    else replyTo = m.to.filter(notMe).length ? m.to.filter(notMe) : m.to
    let to = mode === 'forward' ? [] : replyTo.filter(notMe)
    if (mode !== 'forward' && !to.length) to = replyTo
    const ccBase = lastReceived ?? m
    const cc = mode === 'replyAll' ? [...ccBase.to, ...ccBase.cc].filter((x) => notMe(x) && !to.some((r) => r.address.toLowerCase() === x.address.toLowerCase())) : []
    const subject = mode === 'forward' ? (/^(fwd?|tr)\s*:/i.test(m.subject) ? m.subject : `Fwd: ${m.subject}`) : /^re\s*:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`
    return { id: crypto.randomUUID(), accountId: a.id, threadId, replyToMessageId: mode === 'forward' ? null : m.id, forwardOfMessageId: mode === 'forward' ? m.id : null, mode, to, cc, bcc: [], subject, html: quote(m), text: '', signatureId: a.defaultSignatureId, attachmentPaths: mode === 'forward' ? m.attachments.filter((x) => x.localPath).map((x) => x.localPath!) : [], imapFolderId: null, imapUid: null, updatedAt: Date.now() }
  },
  openReply: (m, mode, threadId) => {
    void get().buildReply(m, mode, threadId).then((d) => { if (!d) return; if (isComposeWindow()) set({ draft: d }); else void detach(d) })
  },
  sendDirect: async (d) => {
    if (useSettings.getState().app?.confirmSend !== false && !(await useUi.getState().askConfirmSend(d))) return
    const item = await invoke('drafts:send', d)
    const undoSec = useSettings.getState().app?.undoSendSeconds ?? 0
    if (undoSec <= 0) { useUi.getState().toast({ text: 'Réponse envoyée', ttl: 1800 }); return }
    const ttl = undoSec * 1000
    const undo = useUi.getState().toast({
      text: 'Réponse envoyée', ttl,
      action: { label: 'Annuler', fn: async () => { const ok = await invoke('outbox:cancel', item.id); useUi.getState().dismissToast(undo); if (ok) { await invoke('compose:open', d.id); useUi.getState().toast({ text: 'Envoi annulé, brouillon rouvert' }) } } }
    })
  },
  openDraft: (d) => { if (isComposeWindow()) set({ draft: d }); else void detach(d) },
  resumeMessage: async (messageId) => { const d = await invoke('drafts:fromMessage', messageId); await invoke('compose:open', d.id) },
  update: (patch) => set((s) => (s.draft ? { draft: { ...s.draft, ...patch } } : s)),
  close: async () => {
    const d = get().draft
    const empty = d ? !d.to.length && !d.cc.length && !d.bcc.length && !d.subject.trim() && !d.html.replace(/<[^>]+>/g, '').trim() && !d.attachmentPaths.length : true
    if (d && !empty) { try { await invoke('drafts:keep', d) } catch { await invoke('drafts:save', d) } }
    else if (d) await invoke('drafts:delete', d.id)
    set({ draft: null })
    if (isComposeWindow()) window.api.closeSelf()
  },
  send: async () => {
    const d = get().draft
    if (!d) return
    if (useSettings.getState().app?.confirmSend !== false && !(await useUi.getState().askConfirmSend(d))) return
    const item = await invoke('drafts:send', d)
    set({ draft: null, sent: true })
    const undoSec = useSettings.getState().app?.undoSendSeconds ?? 0
    if (undoSec <= 0) {
      useUi.getState().toast({ text: 'Message envoyé', ttl: 1800 })
      if (isComposeWindow()) setTimeout(() => window.api.closeSelf(), 250)
      return
    }
    const ttl = undoSec * 1000
    const undo = useUi.getState().toast({
      text: 'Message envoyé', ttl,
      action: { label: 'Annuler', fn: async () => { const ok = await invoke('outbox:cancel', item.id); useUi.getState().dismissToast(undo); if (ok) { set({ draft: d, sent: false }); useUi.getState().toast({ text: 'Envoi annulé' }) } } }
    })
    if (isComposeWindow()) setTimeout(() => { if (useCompose.getState().sent) window.api.closeSelf() }, ttl + 300)
  },
  onOutbox: (item) => set((s) => ({ outbox: { ...s.outbox, [item.id]: item } }))
}))