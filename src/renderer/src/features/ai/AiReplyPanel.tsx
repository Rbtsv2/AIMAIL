// src/renderer/src/features/ai/AiReplyPanel.tsx
import { AnimatePresence, motion } from 'framer-motion'
import { X, Square, RotateCcw, PenLine, Copy, Send } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Sparkles, ArrowUp } from 'lucide-react'
import { useAccounts } from '@/stores/accounts.store'
import { invoke } from '@/lib/api'
import { useAi } from '@/stores/ai.store'
import { useMail } from '@/stores/mail.store'
import { useCompose } from '@/stores/compose.store'
import { useUi } from '@/stores/ui.store'
import { Settings } from 'lucide-react'
import { AI_TASK_LABELS } from '@shared/ai/AiTask'
import { pop } from '@/design-system/motion'
import { useAiOnThread } from './useAi'
import { useSmoothText } from './useSmoothText'
import { useReplies } from '@/stores/replies.store'
import { useSettings } from '@/stores/settings.store'
import { SigFrame } from '@/design-system/SigFrame'
import { BookmarkCheck, ChevronDown, ChevronUp } from 'lucide-react'

export function AiReplyPanel() {
  const task = useAi((s) => s.task)
  const output = useAi((s) => s.output)
  const streaming = useAi((s) => s.streaming)
  const error = useAi((s) => s.error)
  const clear = useAi((s) => s.clear)
  const cancel = useAi((s) => s.cancel)
  const cur = useMail((s) => s.current)
  const { trigger } = useAiOnThread()
  const autoReply = useAi((s) => s.settings?.autoReply && s.settings.enabled)
  const accounts = useAccounts((s) => s.accounts)
  const tool = useAi((s) => s.tool)
  const setOutput = useAi((s) => s.setOutput)
  const shown = useSmoothText(output, streaming)
  const settled = !streaming && shown === output
  const editRef = useRef<HTMLTextAreaElement>(null)
  const [sel, setSel] = useState<{ start: number; end: number; text: string } | null>(null)
  useLayoutEffect(() => { const el = editRef.current; if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }, [output, settled, sel])

  // sélection d’un passage → reprise par l’IA de ce passage uniquement
  const [selPrompt, setSelPrompt] = useState('')
  const [frag, setFrag] = useState<{ start: number; end: number; base: string } | null>(null)
  const onSelect = () => {
    const el = editRef.current
    if (!el) return
    const { selectionStart: a, selectionEnd: b } = el
    if (b - a >= 3) setSel({ start: a, end: b, text: el.value.slice(a, b) }); else setSel(null)
  }
  const rewriteSel = (instruction: string) => {
    if (!sel || !cur) return
    setFrag({ start: sel.start, end: sel.end, base: output })
    setSel(null); setSelPrompt('')
    void useAi.getState().run({ task: 'rewrite', accountId: cur.thread.accountId, threadId: cur.thread.id, selection: sel.text, userPrompt: `${instruction}\nNe réécris QUE le texte sélectionné, sans salutation ni formule de politesse ajoutée, en gardant sa place dans le mail.` })
  }
  useEffect(() => {
    if (!frag || streaming) return
    if (!error) setOutput(frag.base.slice(0, frag.start) + output.trim() + frag.base.slice(frag.end))
    else setOutput(frag.base)
    setFrag(null)
  }, [streaming])

  // réponse préparée en lot pour ce fil : affichée telle quelle, modifications conservées en base
  const prepared = useReplies((s) => cur ? s.forThread(cur.thread.id) : undefined)
  const preparedId = prepared?.status === 'ready' ? prepared.messageId : null
  useEffect(() => {
    if (!cur || !preparedId || !prepared) return
    useAi.getState().clear()
    useAi.setState({ task: 'reply', streamId: null, output: prepared.text, streaming: false, error: null, tool: null })
  }, [cur?.thread.id, preparedId])
  useEffect(() => {
    if (!preparedId || streaming || !settled || !output || output === prepared?.text) return
    const t = setTimeout(() => { void invoke('replies:update', preparedId, output) }, 600)
    return () => clearTimeout(t)
  }, [output, preparedId, settled])

  useEffect(() => {
    if (!autoReply || !cur) return
    if (useReplies.getState().forThread(cur.thread.id)?.status === 'ready') return   // déjà préparée
    const last = cur.messages[cur.messages.length - 1]
    const me = accounts.find((a) => a.id === cur.thread.accountId)?.email.toLowerCase()
    if (!last || !me || last.from.address.toLowerCase() === me) { clear(); return }
    if (/no[-_.]?reply|ne[-_.]?pas[-_.]?repondre|donotreply|mailer-daemon|notification/i.test(last.from.address) || last.category === 'newsletter' || last.category === 'spam') { clear(); return }
    trigger('reply', undefined, true)
  }, [cur?.thread.id, autoReply])

  const toHtml = (t: string) => t.split(/\n{2,}/).map((p) => `<p>${p.replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>`).join('')
  const insertAsReply = async () => {
    if (!cur) return
    const last = cur.messages[cur.messages.length - 1]
    const d = await useCompose.getState().buildReply(last, 'reply', cur.thread.id)
    if (!d) return
    const draft = { ...d, html: toHtml(output) + d.html }
    await invoke('drafts:save', draft)
    await invoke('compose:open', draft.id)
    clear()
  }
  // signature qui sera ajoutée à l'envoi : même règle que le composeur (préférée du compte, sinon l'unique candidate)
  const signatures = useSettings((s) => s.signatures)
  const sigHtml = (() => {
    if (!cur) return ''
    const acc = accounts.find((a) => a.id === cur.thread.accountId)
    if (!acc) return ''
    if (acc.defaultSignatureId) { const d = signatures.find((x) => x.id === acc.defaultSignatureId); if (d) return d.html }
    const cands = signatures.filter((x) => !x.accountId || x.accountId === acc.id)
    return (cands.length === 1 ? cands[0] : cands.find((x) => x.accountId === acc.id))?.html ?? ''
  })()
  // repli du panneau (pour lire le mail dessous) et place réservée en bas du fil pour pouvoir défiler jusqu'au bout
  const [collapsed, setCollapsed] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  // poignée de redimensionnement (style iOS) : glisser pour agrandir / abaisser, relâcher bas = replier
  const [height, setHeight] = useState<number | null>(null)
  const drag = useRef<{ y: number; h: number } | null>(null)
  const onGrab = (e: React.PointerEvent) => {
    const el = panelRef.current; if (!el) return
    e.preventDefault(); (e.target as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { y: e.clientY, h: el.getBoundingClientRect().height }
    if (collapsed) setCollapsed(false)
    el.classList.add('resizing')
  }
  const onGrabMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const max = window.innerHeight * 0.9
    const h = Math.max(56, Math.min(max, drag.current.h - (e.clientY - drag.current.y)))
    setHeight(h)
  }
  const onGrabEnd = () => {
    const el = panelRef.current; if (!drag.current || !el) return
    el.classList.remove('resizing'); drag.current = null
    if ((height ?? 999) < 110) { setCollapsed(true); setHeight(null) }
  }
  useEffect(() => { setCollapsed(false); setHeight(null) }, [cur?.thread.id, task])
  useEffect(() => {
    const el = panelRef.current
    const root = document.documentElement
    if (!el) { root.style.removeProperty('--aipanel-h'); return }
    const ro = new ResizeObserver(() => root.style.setProperty('--aipanel-h', `${el.getBoundingClientRect().height}px`))
    ro.observe(el)
    return () => { ro.disconnect(); root.style.removeProperty('--aipanel-h') }
  }, [!!(output || streaming || error)])
  const copy = async () => { await navigator.clipboard.writeText(output); useUi.getState().toast({ text: 'Copié' }) }
  const sendNow = async () => {
    if (!cur) return
    const last = cur.messages[cur.messages.length - 1]
    const d = await useCompose.getState().buildReply(last, 'reply', cur.thread.id)
    if (!d) return
    await useCompose.getState().sendDirect({ ...d, html: toHtml(output) + d.html })
    clear()
  }

  return (
    <AnimatePresence>
      {task && (
        <motion.div ref={panelRef} className={`aipanel no-drag ${collapsed ? 'collapsed' : ''} ${height ? 'sized' : ''}`} style={height && !collapsed ? { height, maxHeight: 'none' } : undefined} {...pop} role="region" aria-live="polite">
          <div className="aipanel-grab" onPointerDown={onGrab} onPointerMove={onGrabMove} onPointerUp={onGrabEnd} onPointerCancel={onGrabEnd} onDoubleClick={() => { setCollapsed(!collapsed); setHeight(null) }} title="Glisser pour agrandir ou abaisser · double-clic pour replier"><span /></div>
          <div className="aipanel-body">
            {error
              ? <div className="ai-error"><span>{error}</span>{/Réglages/.test(error) && <button className="btn quiet" onClick={() => { clear(); useUi.getState().openSettings('ai') }}><Settings size={13} /> Ouvrir les réglages</button>}</div>
              : frag
                ? <span>{frag.base.slice(0, frag.start)}<mark className={`ai-frag ${streaming ? 'cursor' : ''}`}>{shown}</mark>{frag.base.slice(frag.end)}</span>
              : settled && output
                ? <>
                    {sel
                      ? <div className="ai-selview" onClick={() => { setSel(null); setTimeout(() => editRef.current?.focus(), 10) }}>{output.slice(0, sel.start)}<mark className="ai-sel">{sel.text}</mark>{output.slice(sel.end)}</div>
                      : <textarea ref={editRef} className="ai-edit" value={output} spellCheck onChange={(e) => setOutput(e.target.value)} onMouseUp={(e) => { if (e.altKey) onSelect() }} onDoubleClick={() => { const el = editRef.current; if (!el) return; /* étendre à la phrase pour une retouche utile */ const v = el.value; let a = el.selectionStart, b = el.selectionEnd; if (b - a < 3) return; while (a > 0 && !/[.!?\n]/.test(v[a - 1])) a--; while (b < v.length && !/[.!?\n]/.test(v[b])) b++; if (b < v.length) b++; el.setSelectionRange(a, b); onSelect() }} title="Double-clic sur une phrase (ou Alt + sélection) pour la retoucher avec l’assistant" />}
                    {sigHtml && (task === 'reply' || task === 'rewrite') && !streaming && (
                      <div className="ai-sig" title="Signature ajoutée automatiquement à l’envoi (Réglages → Signatures)">
                        <SigFrame html={sigHtml} />
                      </div>
                    )}
                    {sel && (
                      <div className="ai-selbar" onClick={(e) => e.stopPropagation()}>
                        <span className="ai-selchip" title={sel.text}><Sparkles size={12} /> « {sel.text.length > 38 ? sel.text.slice(0, 38) + '…' : sel.text} »</span>
                        <button onClick={() => rewriteSel('Rends ce passage plus court.')}>Plus court</button>
                        <button onClick={() => rewriteSel('Rends ce passage plus chaleureux.')}>Plus chaleureux</button>
                        <button onClick={() => rewriteSel('Rends ce passage plus formel.')}>Plus formel</button>
                        <button onClick={() => rewriteSel('Corrige l’orthographe et la grammaire de ce passage.')}>Corriger</button>
                        <input value={selPrompt} placeholder="Ou une consigne…" onChange={(e) => setSelPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && selPrompt.trim()) rewriteSel(selPrompt.trim()); if (e.key === 'Escape') setSel(null) }} />
                        <button className="go" aria-label="Appliquer" disabled={!selPrompt.trim()} onClick={() => rewriteSel(selPrompt.trim())}><ArrowUp size={13} /></button>
                      </div>
                    )}
                  </>
                : <span className={!settled ? 'cursor' : ''}>{shown || (streaming ? '' : '…')}</span>}
          </div>
          <div className="aipanel-foot">
            <button className="icon-btn" title={collapsed ? 'Déplier la réponse' : 'Replier pour lire le mail'} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>
            <span className="grow">{preparedId ? <><BookmarkCheck size={13} style={{ verticalAlign: -2, marginRight: 4, color: 'var(--accent)' }} />Réponse préparée — en attente d’envoi</> : AI_TASK_LABELS[task]}{tool && <> · consulte <b>{tool}</b></>}</span>
            {streaming
              ? <button className="btn quiet" onClick={() => void cancel()}><Square size={13} /> Arrêter</button>
              : error ? <button className="btn quiet" onClick={() => trigger(task)}><RotateCcw size={13} /> Réessayer</button>
              : <>
                  <button className="btn quiet" onClick={() => trigger(task)}><RotateCcw size={13} /> Relancer</button>
                  <button className="btn quiet" onClick={() => void copy()}><Copy size={13} /> Copier</button>
                  {(task === 'reply' || task === 'rewrite') && <button className="btn quiet" onClick={() => void insertAsReply()}><PenLine size={13} /> Modifier</button>}
                  {(task === 'reply' || task === 'rewrite') && <button className="btn primary" onClick={() => void sendNow()}><Send size={13} /> Envoyer</button>}
                  {task === 'chat' && <button className="btn primary" onClick={() => void insertAsReply()}><PenLine size={13} /> Utiliser comme réponse</button>}
                </>}
            {preparedId && !streaming && <button className="btn quiet" title="Ne pas répondre à ce message" onClick={() => { void useReplies.getState().dismiss(preparedId); clear() }}>Ignorer</button>}
            <button className="icon-btn" aria-label="Fermer" onClick={clear}><X size={15} /></button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}