// src/renderer/src/features/inbox/ThreadRow.tsx
import { memo } from 'react'
import { Paperclip, Star, Archive, Trash2, Reply, Sparkles, BellOff } from 'lucide-react'
import type { Thread } from '@shared/models/Thread'
import { relativeDate } from '@/lib/dates'
import { displayName } from '@/lib/text'
import { useMail } from '@/stores/mail.store'
import { useAccounts } from '@/stores/accounts.store'
import { beginDrag, clickSuppressed, useDnd } from '@/lib/dnd'

const CAT_LABEL: Record<string, string> = { urgent: 'Urgent', action: 'Action', information: 'Info', newsletter: 'Newsletter', spam: 'Spam' }

export const ThreadRow = memo(function ThreadRow({ t, selected, showAccount, onContext }: { t: Thread; selected: boolean; showAccount: boolean; onContext?: (e: React.MouseEvent) => void }) {
  const clickSelect = useMail((s) => s.clickSelect)
  const inSelection = useMail((s) => s.selection.length > 1 && s.selection.includes(t.id))
  const color = useAccounts((s) => s.accounts.find((a) => a.id === t.accountId)?.color)
  const names = t.participants.slice(0, 3).map(displayName).join(', ')
  const lifting = useDnd((s) => (s.payload?.kind === 'thread' && s.payload.id === t.id) || (s.payload?.kind === 'threads' && !!s.payload.ids?.includes(t.id)))
  return (
    <div role="option" aria-selected={selected} tabIndex={-1} className={`row ${selected ? 'selected' : ''} ${inSelection ? 'multi' : ''} ${t.unread ? 'unread' : ''} ${lifting ? 'lifting' : ''}`} onClick={(e) => { if (!clickSuppressed()) clickSelect(t.id, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey }) }} onContextMenu={onContext}
      data-thread={t.id}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('.row-actions') || e.ctrlKey || e.metaKey || e.shiftKey) return
        if (e.clientX - e.currentTarget.getBoundingClientRect().left < 26) return
        const sel = useMail.getState().selection
        if (sel.length > 1 && sel.includes(t.id)) beginDrag(e, { kind: 'threads', id: t.id, ids: sel, label: `${sel.length} conversations`, count: sel.length })
        else beginDrag(e, { kind: 'thread', id: t.id, label: t.subject || '(sans objet)', count: t.messageCount })
      }}>
      <div className="unread-dot" />
      <div style={{ minWidth: 0 }}>
        <div className="l1">
          {showAccount && <span style={{ width: 6, height: 6, borderRadius: 3, background: color, flex: 'none' }} />}
          <span className="from">{names || '(inconnu)'}{t.messageCount > 1 && <span style={{ color: 'var(--text-2)', fontWeight: 400 }}> {t.messageCount}</span>}</span>
          <span className="date">{relativeDate(t.lastDate)}</span>
        </div>
        <div className="subject">{t.category && <span className={`cat cat-${t.category}`}>{CAT_LABEL[t.category] ?? t.category}</span>}{t.subject || '(sans objet)'}</div>
        <div className="snippet">
          <span className="badges">{t.starred && <Star size={11} fill="currentColor" style={{ color: 'var(--warm)' }} />}{t.hasAttachments && <Paperclip size={11} />}{t.lastFromMe && <span className="rs rs-sent" title="Dernier message : vous — répondu"><Reply size={10} /></span>}{!t.lastFromMe && (t.replyState === 'ready') && <span className="rs rs-ready" title="Réponse préparée, en attente d’envoi"><Sparkles size={10} /></span>}{!t.lastFromMe && (t.replyState === 'generating' || t.replyState === 'pending') && <span className="rs rs-busy" title="Réponse en cours de rédaction"><Sparkles size={10} /></span>}{!t.lastFromMe && t.replyState === 'dismissed' && <span className="rs rs-off" title="Réponse ignorée (pas de réponse prévue)"><BellOff size={10} /></span>}</span>
          {t.snippet}
        </div>
      </div>
      <div className="row-actions" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn" title="Archiver (e)" onClick={() => void useMail.getState().archive(t.id)}><Archive size={14} /></button>
        <button className="icon-btn" title="Supprimer (#)" onClick={() => void useMail.getState().trash(t.id)}><Trash2 size={14} /></button>
      </div>
    </div>
  )
})