// src/renderer/src/features/ai/RepliesHub.tsx
// Zone de droite sans message sélectionné : lancement de la préparation des réponses et suivi en cartes / liste.
import { useEffect, useState } from 'react'
import { invoke } from '@/lib/api'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, LayoutGrid, List, Square, X, RotateCcw, Mail, Check, Loader2, BellOff, Undo2, Reply } from 'lucide-react'
import { useMuted } from '@/stores/muted.store'
import { useReplies } from '@/stores/replies.store'
import { useMail } from '@/stores/mail.store'
import { useAi } from '@/stores/ai.store'
import { useUi } from '@/stores/ui.store'
import { relativeDate } from '@/lib/dates'
import type { AiReply } from '@shared/models/AiReply'

function Card({ r, mode }: { r: AiReply; mode: 'cards' | 'list' }) {
  const select = useMail((s) => s.select)
  const dismiss = useReplies((s) => s.dismiss)
  const retry = useReplies((s) => s.retry)
  const restore = useReplies((s) => s.restore)
  const busy = r.status === 'generating' || r.status === 'pending'
  return (
    <motion.div layout className={`reply-card ${mode} ${r.status}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.25 }} onClick={() => { useReplies.getState().setHub(true); void select(r.threadId) }} role="button">
      <div className="rc-head">
        <span className="rc-from">{r.from}</span>
        <span className="rc-date">{relativeDate(r.date)}</span>
      </div>
      <div className="rc-subject">{r.subject || '(sans objet)'}</div>
      <div className="rc-body">
        {r.status === 'ready' && <span className="rc-text">{r.text.slice(0, mode === 'cards' ? 260 : 140)}{r.text.length > (mode === 'cards' ? 260 : 140) ? '…' : ''}</span>}
        {busy && <span className="rc-busy"><Loader2 size={13} className="spin" /> {r.status === 'generating' ? 'Rédaction en cours…' : 'En attente'}</span>}
        {r.status === 'error' && <span className="rc-err">Échec : {r.error}</span>}
        {r.status === 'dismissed' && <span className="rc-text" style={{ opacity: .7 }}>{r.text ? r.text.slice(0, 140) + (r.text.length > 140 ? '…' : '') : 'Ignorée — aucune réponse prévue'}</span>}
        {r.status === 'sent' && <span className="rc-text" style={{ opacity: .7 }}>{r.text.slice(0, 140)}{r.text.length > 140 ? '…' : ''}</span>}
      </div>
      <div className="rc-actions" onClick={(e) => e.stopPropagation()}>
        {r.status === 'ready' && <span className="rc-badge"><Check size={11} /> Prête</span>}
        {r.status === 'sent' && <span className="rc-badge"><Reply size={11} /> Répondu</span>}
        {r.status === 'dismissed' && <span className="rc-badge" style={{ color: 'var(--text-3)' }}><BellOff size={11} /> Ignorée</span>}
        {r.status === 'dismissed' && <button className="icon-btn" title="Remettre dans les réponses à traiter" onClick={() => void restore(r.messageId)}><Undo2 size={13} /></button>}
        {r.status === 'error' && <button className="icon-btn" title="Réessayer" onClick={() => void retry(r.messageId)}><RotateCcw size={13} /></button>}
        {(r.status === 'ready' || r.status === 'error' || busy) && <button className="icon-btn" title={`Ne plus préparer de réponse pour ${r.fromAddress}`} onClick={async () => { await useMuted.getState().toggle(r.fromAddress); useUi.getState().toast({ text: `Plus de réponse préparée pour ${r.fromAddress}` }) }}><BellOff size={13} /></button>}
        {(r.status === 'ready' || r.status === 'error' || busy) && <button className="icon-btn" title="Ignorer : pas de réponse à ce message (réversible dans l’onglet Ignorées)" onClick={() => void dismiss(r.messageId)}><X size={13} /></button>}
      </div>
    </motion.div>
  )
}

export function RepliesHub() {
  const items = useReplies((s) => s.items)
  const done = useReplies((s) => s.done)
  const tab = useReplies((s) => s.tab)
  const setTab = useReplies((s) => s.setTab)
  const counts = useReplies((s) => s.counts)
  const mode = useReplies((s) => s.mode)
  const setMode = useReplies((s) => s.setMode)
  const load = useReplies((s) => s.load)
  const generate = useReplies((s) => s.generate)
  const stop = useReplies((s) => s.stop)
  const aiEnabled = useAi((s) => !!s.settings?.enabled)
  const view = useMail((s) => s.view)
  useEffect(() => { void load() }, [])
  const running = counts.generating > 0
  // nombre de messages en attente de réponse (mis à jour à l'ouverture, au changement de compte et à chaque fin de génération)
  const [pending, setPending] = useState<number | null>(null)
  useEffect(() => { let on = true; void invoke('replies:candidates', { accountId: view.accountId }).then((n) => { if (on) setPending(n) }); return () => { on = false } }, [view.accountId, counts.generating, counts.ready, items.length])
  const start = async () => {
    if (!aiEnabled) { useUi.getState().toast({ text: 'Activez l’assistant dans les Réglages', action: { label: 'Réglages', fn: () => useUi.getState().openSettings('ai') } }); return }
    const n = await generate({ accountId: view.accountId })
    useUi.getState().toast({ text: n ? `${n} réponse${n > 1 ? 's' : ''} en préparation` : 'Aucun nouveau message à traiter' })
  }
  const ignored = done.filter((d) => d.status === 'dismissed')
  const sent = done.filter((d) => d.status === 'sent')
  const shown = tab === 'todo' ? items : tab === 'ignored' ? ignored : sent
  if (!items.length && !done.length) {
    return (
      <div className="hub-empty">
        <button className="hub-cta" onClick={() => void start()}>
          <span className="hub-cta-glow" />
          <Sparkles size={18} />
          <span>Préparer les réponses</span>
          {pending !== null && pending > 0 && <span className="hub-cta-count">{pending}</span>}
        </button>
        <p>{pending === 0 ? `Aucun message en attente de réponse${view.accountId ? ' sur ce compte' : ''} ces 14 derniers jours.` : `${pending === null ? 'Les messages' : pending === 1 ? '1 message attend' : `${pending} messages attendent`} une réponse${view.accountId ? ' sur ce compte' : ''}. L’assistant rédige une proposition pour chacun ; elles restent sous les messages, prêtes à envoyer.`}</p>
      </div>
    )
  }
  return (
    <div className="hub">
      <div className="hub-bar">
        <div className="hub-title"><Mail size={15} /> Réponses
          <div className="hub-tabs">
            <button className={tab === 'todo' ? 'on' : ''} onClick={() => setTab('todo')}>À traiter <span className="count">{counts.ready}</span></button>
            <button className={tab === 'ignored' ? 'on' : ''} onClick={() => setTab('ignored')}>Ignorées <span className="count muted">{ignored.length}</span></button>
            <button className={tab === 'sent' ? 'on' : ''} onClick={() => setTab('sent')}>Répondues <span className="count ok">{sent.length}</span></button>
          </div>
          {running && <span className="hub-running"><Loader2 size={12} className="spin" /> {counts.generating} en cours</span>}</div>
        <div className="hub-tools">
          {running ? <button className="btn quiet" onClick={() => void stop()}><Square size={13} /> Arrêter</button> : <button className="btn quiet" disabled={pending === 0} onClick={() => void start()}><Sparkles size={13} /> Préparer d’autres réponses{pending ? ` (${pending})` : ''}</button>}
          <div className="seg">
            <button className={mode === 'cards' ? 'on' : ''} title="Cartes" onClick={() => setMode('cards')}><LayoutGrid size={14} /></button>
            <button className={mode === 'list' ? 'on' : ''} title="Liste" onClick={() => setMode('list')}><List size={14} /></button>
          </div>
        </div>
      </div>
      <div className={`hub-grid ${mode}`}>
        <AnimatePresence>{shown.map((r) => <Card key={r.messageId} r={r} mode={mode} />)}</AnimatePresence>

      </div>
    </div>
  )
}