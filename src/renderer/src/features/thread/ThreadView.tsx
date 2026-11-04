// src/renderer/src/features/thread/ThreadView.tsx
import { Archive, Trash2, Star, MailOpen, Mail, PenLine, Reply, ReplyAll, Forward, ShieldAlert, ShieldCheck } from 'lucide-react'
import { invoke } from '@/lib/api'
import { useUi } from '@/stores/ui.store'
import { AssistantChat } from '@/features/ai/AssistantChat'
import { ChatRefsPanel } from '@/features/ai/ChatRefsPanel'
import { useChat } from '@/stores/chat.store'
import { useAccounts } from '@/stores/accounts.store'
import { useCompose } from '@/stores/compose.store'
import { useMail } from '@/stores/mail.store'
import { Timeline } from './Timeline'
import { AiBar } from '@/features/ai/AiBar'
import { AiReplyPanel } from '@/features/ai/AiReplyPanel'
import { IconButton } from '@/design-system/IconButton'

export function ThreadView() {
  const cur = useMail((s) => s.current)
  const flag = useMail((s) => s.flag)
  const folders = useAccounts((s) => s.folders)
  const selection = useMail((s) => s.selection)
  const bulk = useMail((s) => s.bulk)
  const chatActive = useChat((s) => s.turns.length > 0)
  if (selection.length > 1) {
    const n = selection.length
    return (
      <main className="pane">
        <div className="pane-head drag" />
        <div className="empty"><div className="bulk">
          <h3>{n} conversations sélectionnées</h3>
          <p>Échap pour annuler la sélection.</p>
          <div className="bulk-actions">
            <button className="btn quiet" onClick={() => void bulk('read')}><MailOpen size={15} /> Marquer lues</button>
            <button className="btn quiet" onClick={() => void bulk('unread')}><Mail size={15} /> Non lues</button>
            <button className="btn quiet" onClick={() => void bulk('star')}><Star size={15} /> Suivre</button>
            <button className="btn quiet" onClick={() => void bulk('archive')}><Archive size={15} /> Archiver</button>
            <button className="btn quiet" onClick={() => void bulk('spam')}><ShieldAlert size={15} /> Indésirables</button>
            <button className="btn danger" onClick={() => void bulk('trash')}><Trash2 size={15} /> Supprimer</button>
          </div>
          <p style={{ marginTop: 14 }}>Ou glissez la sélection sur un dossier de la barre latérale.</p>
        </div></div>
      </main>
    )
  }
  if (!cur) {
    return (
      <main className="pane">
        <div className="pane-head drag" />
        {chatActive ? <AssistantChat /> : <div className="empty"><div><h3>Aucun message sélectionné</h3><p>Choisissez un fil à gauche, ou appuyez sur ⌘K.</p><AssistantChat /></div></div>}
      </main>
    )
  }
  const ids = cur.messages.map((m) => m.id)
  const last = cur.messages[cur.messages.length - 1]
  const draftsFolder = (folders[cur.thread.accountId] ?? []).find((f) => f.role === 'drafts')
  const isDraft = !!draftsFolder && !!last && last.folderId === draftsFolder.id
  const spamFolder = (folders[cur.thread.accountId] ?? []).find((f) => f.role === 'spam')
  const isSpam = !!spamFolder && !!last && last.folderId === spamFolder.id
  const report = async (toSpam: boolean) => {
    useMail.getState().selectRelative(1)
    await invoke('messages:move', ids, toSpam ? 'spam' : 'inbox')
    const sender = last?.from.address ?? ''
    useUi.getState().toast({ text: toSpam ? `Indésirable — les prochains messages de ${sender} iront directement dans Indésirables` : `Déplacé dans la réception — ${sender} n’est plus bloqué`, ttl: 6000 })
  }
  return (
    <main className="pane">
      <div className="pane-head drag">
        {isDraft
          ? <button className="btn primary no-drag" style={{ marginRight: 8 }} onClick={() => void useCompose.getState().resumeMessage(last.id)}><PenLine size={14} /> Reprendre la rédaction</button>
          : <>
              <button className="btn quiet no-drag" onClick={() => useCompose.getState().openReply(last, 'reply', cur.thread.id)}><Reply size={15} /> Répondre</button>
              <IconButton label="Répondre à tous (a)" onClick={() => useCompose.getState().openReply(last, 'replyAll', cur.thread.id)}><ReplyAll size={16} /></IconButton>
              <IconButton label="Transférer (f)" onClick={() => useCompose.getState().openReply(last, 'forward', cur.thread.id)}><Forward size={16} /></IconButton>
              <span style={{ width: 1, height: 18, background: 'var(--hairline-strong)', margin: '0 6px' }} />
            </>}
        <IconButton label={cur.thread.unread ? 'Marquer comme lu (u)' : 'Marquer comme non lu (u)'} onClick={() => void flag(ids, { unread: !cur.thread.unread })}>{cur.thread.unread ? <MailOpen size={16} /> : <Mail size={16} />}</IconButton>
        <IconButton label="Suivre (s)" on={cur.thread.starred} onClick={() => void flag(ids, { starred: !cur.thread.starred })}><Star size={16} fill={cur.thread.starred ? 'currentColor' : 'none'} /></IconButton>
        {isSpam
          ? <button className="btn quiet head-btn" title="Pas indésirable : débloque l’expéditeur" onClick={() => void report(false)}><ShieldCheck size={15} /> Pas indésirable</button>
          : <button className="btn quiet head-btn spam" title="Signaler comme indésirable (!) : les prochains messages de cet expéditeur iront directement dans Indésirables" onClick={() => void report(true)}><ShieldAlert size={15} /> Indésirable</button>}
        <IconButton label="Archiver (e)" onClick={() => void useMail.getState().archive(cur.thread.id)}><Archive size={16} /></IconButton>
        <IconButton label="Supprimer (#)" onClick={() => void useMail.getState().trash(cur.thread.id)}><Trash2 size={16} /></IconButton>
      </div>
      <div className="pane-scroll">
        <h1 className="thread-title sel">{cur.thread.subject || '(sans objet)'}</h1>
        <Timeline threadId={cur.thread.id} accountId={cur.thread.accountId} messages={cur.messages} events={cur.events} />
      </div>
      <AiReplyPanel />
      <AiBar />
      <ChatRefsPanel />
    </main>
  )
}