// src/renderer/src/features/inbox/ThreadMenu.tsx
import { useEffect } from 'react'
import { Reply, Forward, Mail, MailOpen, Star, Archive, ShieldAlert, ShieldCheck, Trash2, Inbox, Flame, ListFilter } from 'lucide-react'
import type { Thread } from '@shared/models/Thread'
import { useMail } from '@/stores/mail.store'
import { useAccounts } from '@/stores/accounts.store'
import { useCompose } from '@/stores/compose.store'
import { useUi } from '@/stores/ui.store'
import { invoke } from '@/lib/api'

export type ThreadMenuState = { x: number; y: number; t: Thread } | null

export function ThreadMenu({ menu, onClose }: { menu: ThreadMenuState; onClose: () => void }) {
  const folders = useAccounts((s) => s.folders)
  useEffect(() => {
    if (!menu) return
    window.addEventListener('click', onClose); window.addEventListener('keydown', onClose); window.addEventListener('scroll', onClose, true)
    return () => { window.removeEventListener('click', onClose); window.removeEventListener('keydown', onClose); window.removeEventListener('scroll', onClose, true) }
  }, [menu])
  if (!menu) return null
  const { t } = menu
  const sel = useMail.getState().selection
  const multi = sel.length > 1 && sel.includes(t.id)
  const bulk = useMail.getState().bulk
  const fs = folders[t.accountId] ?? []
  const roleOf = (id: string) => fs.find((f) => f.id === id)?.role
  const inTrash = t.folderIds.some((id) => roleOf(id) === 'trash')
  const inSpam = t.folderIds.some((id) => roleOf(id) === 'spam')
  const ids = async () => (await invoke('threads:get', t.id)).messages.map((m) => m.id)
  const last = async () => { const r = await invoke('threads:get', t.id); return { last: r.messages[r.messages.length - 1], threadId: r.thread.id } }
  const run = (fn: () => Promise<unknown>, ok?: string) => { onClose(); void fn().then(() => ok && useUi.getState().toast({ text: ok, ttl: 1500 })).catch((e: any) => useUi.getState().toast({ text: String(e?.message ?? e).replace(/^Error invoking remote method '[^']+': Error: /, ''), ttl: 6000 })) }
  const next = () => { if (useMail.getState().selectedId === t.id) useMail.getState().selectRelative(1) }
  const style = { left: Math.min(menu.x, window.innerWidth - 230), top: Math.min(menu.y, window.innerHeight - 330) }
  if (multi) return (
    <div className="ctx" style={style} onClick={(e) => e.stopPropagation()}>
      <div className="ctx-title">{sel.length} conversations</div>
      <button onClick={() => { onClose(); void bulk('read') }}><MailOpen size={14} /> Marquer lues</button>
      <button onClick={() => { onClose(); void bulk('unread') }}><Mail size={14} /> Marquer non lues</button>
      <button onClick={() => { onClose(); void bulk('star') }}><Star size={14} /> Suivre</button>
      <div className="sep" />
      {(inTrash || inSpam) ? <button onClick={() => { onClose(); void bulk('inbox') }}><Inbox size={14} /> Restaurer</button> : <>
        <button onClick={() => { onClose(); void bulk('archive') }}><Archive size={14} /> Archiver</button>
        <button onClick={() => { onClose(); void bulk('spam') }}><ShieldAlert size={14} /> Indésirables</button>
      </>}
      <button className="danger" onClick={() => { onClose(); void bulk(inTrash || inSpam ? 'delete' : 'trash') }}><Trash2 size={14} /> Supprimer</button>
    </div>
  )
  return (
    <div className="ctx" style={style} onClick={(e) => e.stopPropagation()}>
      <button onClick={() => run(async () => { const r = await last(); useCompose.getState().openReply(r.last, 'reply', r.threadId) })}><Reply size={14} /> Répondre</button>
      <button onClick={() => run(async () => { const r = await last(); useCompose.getState().openReply(r.last, 'forward', r.threadId) })}><Forward size={14} /> Transférer</button>
      <div className="sep" />
      <button onClick={() => run(async () => invoke('messages:flag', await ids(), { unread: !t.unread }))}>{t.unread ? <MailOpen size={14} /> : <Mail size={14} />} {t.unread ? 'Marquer comme lu' : 'Marquer comme non lu'}</button>
      <button onClick={() => run(async () => invoke('messages:flag', await ids(), { starred: !t.starred }))}><Star size={14} /> {t.starred ? 'Ne plus suivre' : 'Suivre'}</button>
      <div className="sep" />
      {(inTrash || inSpam)
        ? <button onClick={() => run(async () => { next(); await invoke('messages:move', await ids(), 'inbox') }, 'Restauré dans la réception')}><Inbox size={14} /> Restaurer</button>
        : <>
            <button onClick={() => run(async () => { next(); await invoke('messages:move', await ids(), 'archive') }, 'Archivé')}><Archive size={14} /> Archiver</button>
            <button onClick={() => run(async () => { next(); await invoke('messages:move', await ids(), 'spam') }, 'Signalé comme indésirable')}><ShieldAlert size={14} /> Indésirable</button>
            <button onClick={() => run(async () => { const r = await last(); const from = r.last.from; useUi.getState().openRuleFor({ accountId: t.accountId, from: from.address, name: from.name || from.address }) })}><ListFilter size={14} /> Créer une règle pour cet expéditeur…</button>
          </>}
      {inSpam && <button onClick={() => run(async () => { next(); await invoke('messages:move', await ids(), 'inbox') }, 'Pas indésirable')}><ShieldCheck size={14} /> Pas indésirable</button>}
      {!inTrash && <button className="danger" onClick={() => { onClose(); void useMail.getState().trash(t.id) }}><Trash2 size={14} /> Supprimer</button>}
      <button className="danger" onClick={() => { onClose(); if (inTrash || inSpam || confirm('Supprimer définitivement ce fil ? Cette action est irréversible.')) void useMail.getState().deleteForever(t.id) }}><Flame size={14} /> Supprimer définitivement</button>
    </div>
  )
}