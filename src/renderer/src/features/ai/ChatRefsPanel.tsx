// src/renderer/src/features/ai/ChatRefsPanel.tsx
// Colonne de navigation entre les messages d'une réponse de l'assistant, conservée pendant la lecture d'un fil.
import { Inbox, Mail, X, MessageSquare } from 'lucide-react'
import { useChat, type MailRef } from '@/stores/chat.store'
import { useMail } from '@/stores/mail.store'
import { relativeDate } from '@/lib/dates'

export function ChatRefsList({ refs, activeThreadId }: { refs: MailRef[]; activeThreadId?: string | null }) {
  const select = useMail((s) => s.select)
  // toujours du plus récent au plus ancien, sans doublon de fil
  const seen = new Set<string>()
  const ordered = [...refs].sort((a, b) => b.date - a.date).filter((r) => !seen.has(r.threadId) && seen.add(r.threadId))
  return (
    <div className="chat-panel-list">
      {ordered.map((r) => (
        <button key={r.messageId} className={`chat-ref ${activeThreadId === r.threadId ? 'on' : ''}`} onClick={() => { useChat.getState().openPanel(ordered); void select(r.threadId) }} title={`${r.from} · ${r.account}`}>
          <Mail size={13} /><span className="cr-subject">{r.subject || '(sans objet)'}</span><span className="cr-meta">{r.from} · {relativeDate(r.date)}</span>
        </button>
      ))}
    </div>
  )
}

export function ChatRefsPanel() {
  const panel = useChat((s) => s.panel)
  const selected = useMail((s) => s.selectedId)
  if (!panel.open || !panel.refs.length) return null
  return (
    <aside className="chat-panel docked">
      <div className="chat-panel-head">
        <Inbox size={14} /> Messages <span className="count">{panel.refs.length}</span>
        <button className="icon-btn" title="Revenir à la conversation" onClick={() => void useMail.getState().select(null)}><MessageSquare size={14} /></button>
        <button className="icon-btn" title="Fermer" onClick={() => useChat.getState().closePanel()}><X size={14} /></button>
      </div>
      <ChatRefsList refs={panel.refs} activeThreadId={selected} />
    </aside>
  )
}