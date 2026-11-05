// src/renderer/src/features/thread/MessageCard.tsx
import { useEffect, useState } from 'react'
import { Reply, ReplyAll, Forward, Star } from 'lucide-react'
import type { Message } from '@shared/models/Message'
import { Avatar } from '@/design-system/Avatar'
import { MessageBody } from './MessageBody'
import { AttachmentChip } from './AttachmentChip'
import { InvitationCard } from './InvitationCard'
import { EventSuggestion } from './EventSuggestion'
import { fullDate, relativeDate } from '@/lib/dates'
import { displayName } from '@/lib/text'
import { invoke } from '@/lib/api'
import { useCompose } from '@/stores/compose.store'
import { useMail } from '@/stores/mail.store'
import { useSettings } from '@/stores/settings.store'
import { useUi } from '@/stores/ui.store'
import { useMuted } from '@/stores/muted.store'
import { BellOff, Sparkles } from 'lucide-react'
import type { Address } from '@shared/models/Message'

const copyAddr = async (e: React.MouseEvent, a: Address) => {
  e.stopPropagation()
  await navigator.clipboard.writeText(a.name ? `${a.name} <${a.address}>` : a.address)
  useUi.getState().toast({ text: `${a.address} copiée`, ttl: 1500 })
}

const bodyCache = new Map<string, Message>()

// Interrupteur « réponses de l'assistant » pour cet expéditeur
function MuteSwitch({ address }: { address: string }) {
  const muted = useMuted((s) => s.addresses.has(address.toLowerCase()))
  return (
    <button className={`mute-switch ${muted ? 'off' : 'on'}`} title={muted ? 'L’assistant ne prépare pas de réponse pour cet expéditeur — cliquer pour réactiver' : 'L’assistant prépare des réponses pour cet expéditeur — cliquer pour désactiver'}
      onClick={async (e) => { e.stopPropagation(); const on = await useMuted.getState().toggle(address); useUi.getState().toast({ text: on ? `Plus de réponse préparée pour ${address}` : `Réponses préparées réactivées pour ${address}` }) }}>
      <span className="knob" />
      {muted ? <BellOff size={10} /> : <Sparkles size={10} />}
    </button>
  )
}

export function MessageCard({ m, threadId, expandedByDefault }: { m: Message; threadId: string; expandedByDefault: boolean }) {
  const [open, setOpen] = useState(expandedByDefault)
  const [full, setFull] = useState<Message | null>(bodyCache.get(m.id) ?? null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const delay = useSettings((s) => s.app?.markReadDelayMs ?? 800)

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoadError(null)
    if (!bodyCache.has(m.id)) void invoke('messages:body', m.id).then((x) => { bodyCache.set(m.id, x); if (alive) setFull(x) }, (e: any) => { if (alive) setLoadError(e?.message ?? 'Impossible de charger le message') })
    const t = m.unread ? setTimeout(() => void useMail.getState().flag([m.id], { unread: false }), delay) : null
    return () => { alive = false; if (t) clearTimeout(t) }
  }, [open, m.id, retry])

  const msg = full ?? m
  const atts = msg.attachments.filter((a) => !a.inline)
  return (
    <article className="msg">
      <button className="msg-head" onClick={() => setOpen((o) => !o)}>
        <Avatar who={m.from} />
        <div className="who">
          <span className="name">{displayName(m.from)}<span className="addr copy" title="Copier l’adresse" onClick={(e) => void copyAddr(e, m.from)}>{m.from.address}</span><MuteSwitch address={m.from.address} /></span>
          <span className="meta">{open
            ? <>à {[...m.to, ...m.cc].length ? [...m.to, ...m.cc].map((a, i) => <span key={`${a.address}-${i}`}><span className="copy" title={`Copier ${a.address}`} onClick={(e) => void copyAddr(e, a)}>{displayName(a)}</span>{i < m.to.length + m.cc.length - 1 ? ', ' : ''}</span>) : 'moi'}</>
            : msg.snippet}</span>
        </div>
        <span className="date" title={fullDate(m.date)}>{relativeDate(m.date)}</span>
      </button>
      {open && (
        <>
          {full && (full.attachments.some((a) => /text\/calendar|application\/ics/i.test(a.mimeType) || /\.ics$/i.test(a.filename)) ? <InvitationCard messageId={m.id} /> : <EventSuggestion messageId={m.id} />)}
          {full ? <MessageBody m={full} /> : loadError ? <div className="msg-body msg-load-error"><span>{loadError}</span><button className="btn quiet" onClick={() => setRetry((r) => r + 1)}>Réessayer</button></div> : <div className="msg-body"><div className="skeleton" style={{ width: '60%', marginBottom: 8 }} /><div className="skeleton" style={{ width: '90%', marginBottom: 8 }} /><div className="skeleton" style={{ width: '40%' }} /></div>}
          {atts.length > 0 && <div className="msg-atts">{atts.map((a) => <AttachmentChip key={a.id} a={a} />)}</div>}
          <div style={{ display: 'flex', gap: 2, padding: '0 12px 10px' }}>
            <button className="btn quiet" onClick={() => useCompose.getState().openReply(msg, 'reply', threadId)}><Reply size={14} /> Répondre</button>
            <button className="btn quiet" onClick={() => useCompose.getState().openReply(msg, 'replyAll', threadId)}><ReplyAll size={14} /> À tous</button>
            <button className="btn quiet" onClick={() => useCompose.getState().openReply(msg, 'forward', threadId)}><Forward size={14} /> Transférer</button>
            <div style={{ flex: 1 }} />
            <button className={`icon-btn ${m.starred ? 'on' : ''}`} aria-label="Suivre" onClick={() => void useMail.getState().flag([m.id], { starred: !m.starred })}><Star size={15} fill={m.starred ? 'currentColor' : 'none'} /></button>
          </div>
        </>
      )}
    </article>
  )
}