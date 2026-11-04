// src/renderer/src/features/ai/AssistantChat.tsx
import { useEffect, useRef, useState } from 'react'
import { Sparkles, ArrowUp, Trash2, Mail, Square, Search, BookOpen, Inbox } from 'lucide-react'
import { ChatRefsList } from './ChatRefsPanel'
import { useAi } from '@/stores/ai.store'
import { useAccounts } from '@/stores/accounts.store'
import { useChat, type MailRef } from '@/stores/chat.store'
import { useSmoothText } from './useSmoothText'
import { useUi } from '@/stores/ui.store'

const Dots = () => <span className="dots"><i /><i /><i /></span>
const stepIcon = (s: string) => /recherche/i.test(s) ? <Search size={12} /> : /lecture/i.test(s) ? <BookOpen size={12} /> : <Sparkles size={12} />

function AssistantTurn({ id, content, streaming, error, tool, refs, shown: shownTurnId, onShow }: { id: string; content: string; streaming?: boolean; error?: string; tool?: string | null; refs: MailRef[]; steps?: string[]; shown: string | null; onShow: (id: string) => void }) {
  const shown = useSmoothText(content, !!streaming)
  if (streaming && !content && !error) return (
    <div className="chat-turn assistant thinking" data-id={id}>
      <div className="chat-avatar pulse"><Sparkles size={13} /></div>
      <div className="chat-think">
        <div key={tool ?? 'init'} className="chat-step now">{tool ? stepIcon(tool) : <Sparkles size={12} />}<span className="step-text">{tool ?? 'Réflexion en cours'}</span><Dots /></div>
      </div>
    </div>
  )
  return (
    <div className="chat-turn assistant" data-id={id}>
      <div className="chat-avatar"><Sparkles size={13} /></div>
      <div className="chat-bubble">


        {error ? <span className="err">{error}</span> : <div className={`chat-text ${streaming && shown !== content ? 'cursor' : ''}`}>{shown || (streaming ? '' : '…')}</div>}
        {refs.length > 0 && (
          <button className={`chat-refs-chip ${shownTurnId === id ? 'on' : ''}`} onClick={() => onShow(id)}><Mail size={12} /> {refs.length} message{refs.length > 1 ? 's' : ''}</button>
        )}
      </div>
    </div>
  )
}

export function AssistantChat() {
  const settings = useAi((s) => s.settings)
  const accounts = useAccounts((s) => s.accounts)
  const turns = useChat((s) => s.turns)
  const streaming = useAi((s) => s.streaming)
  const [q, setQ] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [shownTurn, setShownTurn] = useState<string | null>(null)
  const lastWithRefs = [...turns].reverse().find((t) => t.role === 'assistant' && t.refs.length)
  const panelTurn = turns.find((t) => t.id === shownTurn && t.refs.length) ?? lastWithRefs
  const panelRefs = panelTurn?.refs ?? []
  const focusTick = useChat((s) => s.focusTick)
  useEffect(() => { if (focusTick) { if (useAi.getState().streaming) void useAi.getState().cancel(); setQ(''); requestAnimationFrame(() => inputRef.current?.focus()) } }, [focusTick])
  const stick = useRef(true)
  const onScroll = () => { const el = scrollRef.current; if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80 }

  const lastUserId = turns.filter((t) => t.role === 'user').slice(-1)[0]?.id
  useEffect(() => { stick.current = true; scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [lastUserId])
  useEffect(() => { const el = scrollRef.current; if (el && stick.current) el.scrollTop = el.scrollHeight }, [turns])

  if (!settings?.enabled) return null
  if (!settings.mailSearch || !settings.mailSearchAccountIds.length) return (
    <div className="chat-off"><Sparkles size={13} /> L’assistant n’a pas accès à vos messages. <button onClick={() => useUi.getState().openSettings('ai')}>Autoriser</button></div>
  )
  const ask = () => {
    const p = q.trim(); if (!p || streaming) return
    const allowed = accounts.filter((a) => settings.mailSearchAccountIds.includes(a.id))
    const prevTurns = useChat.getState().turns.filter((t) => !t.error)
    const history = prevTurns.map((t) => ({ role: t.role, content: t.content }))
    const lastRefs = [...prevTurns].reverse().find((t) => t.role === 'assistant' && t.refs.length)?.refs.map((r) => r.messageId) ?? []
    useChat.getState().add({ id: crypto.randomUUID(), role: 'user', content: p, refs: [] })
    const aid = crypto.randomUUID()
    useChat.getState().setActive(aid)
    useChat.getState().add({ id: aid, role: 'assistant', content: '', refs: [], streaming: true })
    void useAi.getState().run({ task: 'chat', accountId: (allowed[0] ?? accounts[0]).id, userPrompt: p, global: true, history, lastRefs })
    setQ('')
    requestAnimationFrame(() => inputRef.current?.focus())
  }
  const stop = () => { void useAi.getState().cancel(); const c = useChat.getState(); if (c.activeTurnId) { c.update(c.activeTurnId, { streaming: false }); c.setActive(null) } }

  return (
    <div className={`chat ${turns.length ? 'active' : ''} ${turns.length && panelRefs.length ? 'with-panel' : ''}`}>
      {turns.length > 0 && panelRefs.length > 0 && (
        <aside className="chat-panel">
          <div className="chat-panel-head"><Inbox size={14} /> Messages <span className="count">{panelRefs.length}</span></div>
          <ChatRefsList refs={panelRefs} />
        </aside>
      )}
      <div className="chat-main">
      {turns.length > 0 && (
        <div className="chat-scroll" ref={scrollRef} onScroll={onScroll}>
          {turns.map((t) => t.role === 'user'
            ? <div key={t.id} className="chat-turn user"><div className="chat-bubble">{t.content}</div></div>
            : <AssistantTurn key={t.id} {...t} shown={panelTurn?.id ?? null} onShow={setShownTurn} />)}
        </div>
      )}
      <div className="chat-input">
        {turns.length > 0 && <button className="icon-btn" title="Nouvelle conversation" onMouseDown={(e) => e.preventDefault()} onClick={() => { if (useAi.getState().streaming) void useAi.getState().cancel(); useChat.getState().clear() }}><Trash2 size={15} /></button>}
        <Sparkles size={15} style={{ color: 'var(--accent)' }} />
        <input ref={inputRef} autoFocus value={q} placeholder={turns.length ? 'Continuer…' : 'Poser une question sur vos messages…'} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} />
        {streaming ? <button className="btn quiet" onClick={stop} aria-label="Arrêter"><Square size={14} /></button> : <button className="btn primary" disabled={!q.trim()} onMouseDown={(e) => e.preventDefault()} onClick={ask} aria-label="Demander"><ArrowUp size={14} /></button>}
      </div>
      </div>
    </div>
  )
}