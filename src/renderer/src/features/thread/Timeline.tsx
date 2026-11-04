// src/renderer/src/features/thread/Timeline.tsx
import { Fragment, useMemo } from 'react'
import { Forward, Reply, ArrowDownLeft, ArrowUpRight, ExternalLink } from 'lucide-react'
import type { Message } from '@shared/models/Message'
import type { ThreadEvent } from '@shared/ipc'
import { MessageCard } from './MessageCard'
import { useMail } from '@/stores/mail.store'
import { useAccounts } from '@/stores/accounts.store'
import { displayName } from '@/lib/text'

type Node =
  | { kind: 'message'; date: number; m: Message; mine: boolean; replyTo: Message | null }
  | { kind: 'event'; date: number; e: ThreadEvent; parent: Message | null }

const dayLabel = (ts: number): string => {
  const d = new Date(ts), now = new Date()
  const sameYear = d.getFullYear() === now.getFullYear()
  if (d.toDateString() === now.toDateString()) return 'Aujourd’hui'
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: sameYear ? undefined : 'numeric' })
}
const time = (ts: number): string => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

export function Timeline({ threadId, accountId, messages, events }: { threadId: string; accountId: string; messages: Message[]; events: ThreadEvent[] }) {
  const me = useAccounts((s) => s.accounts.find((a) => a.id === accountId)?.email.toLowerCase() ?? '')
  const select = useMail((s) => s.select)

  const nodes = useMemo<Node[]>(() => {
    const byMid = new Map(messages.map((m) => [m.messageId, m]))
    const list: Node[] = messages.map((m) => ({
      kind: 'message', date: m.date, m, mine: m.from.address.toLowerCase() === me,
      replyTo: (m.inReplyTo && byMid.get(m.inReplyTo)) || (m.references.length ? byMid.get(m.references[m.references.length - 1]) ?? null : null)
    }))
    for (const e of events) list.push({ kind: 'event', date: e.date, e, parent: byMid.get(e.parentMessageId) ?? null })
    return list.sort((a, b) => a.date - b.date)
  }, [messages, events, me])

  let lastDay = ''
  const lastIdx = nodes.length - 1
  return (
    <div className="timeline">
      {nodes.map((n, i) => {
        const day = dayLabel(n.date)
        const showDay = day !== lastDay
        lastDay = day
        const key = n.kind === 'message' ? n.m.id : `${n.e.childMessageId}-${i}`
        return (
          <Fragment key={key}>
            {showDay && <div className="tl-day"><span>{day}</span></div>}
            <div className={`tl-node ${n.kind === 'message' ? (n.mine ? 'out' : 'in') : n.e.kind}`}>
              <div className="tl-rail"><span className="tl-dot">
                {n.kind === 'event' ? (n.e.kind === 'forward' ? <Forward size={10} /> : <Reply size={10} />) : n.mine ? <ArrowUpRight size={10} /> : <ArrowDownLeft size={10} />}
              </span></div>
              <div className="tl-body">
                <div className="tl-meta">
                  <span className="tl-time">{time(n.date)}</span>
                  {n.kind === 'message'
                    ? n.mine
                      ? <span>Vous avez {n.replyTo ? <>répondu à <b>{displayName(n.replyTo.from)}</b></> : 'écrit'}</span>
                      : <span><b>{displayName(n.m.from)}</b>{n.replyTo ? <> a répondu{n.replyTo.from.address.toLowerCase() === me ? '' : <> à {displayName(n.replyTo.from)}</>}</> : i === 0 ? ' a démarré la discussion' : ' a écrit'}</span>
                    : <span>Vous avez {n.e.kind === 'forward' ? 'transféré' : 'répondu'}{n.parent ? <> le message de <b>{displayName(n.parent.from)}</b></> : ''} à <b>{n.e.to.map(displayName).join(', ') || '…'}</b></span>}
                </div>
                {n.kind === 'message'
                  ? <MessageCard m={n.m} threadId={threadId} expandedByDefault={i === lastIdx || n.m.unread} />
                  : n.e.childThreadId && <button className="tl-link" onClick={() => void select(n.e.childThreadId!)}><ExternalLink size={13} /> Ouvrir « {n.e.childSubject || 'le message transféré'} »</button>}
              </div>
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}