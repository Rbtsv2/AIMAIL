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

  useEffect(() => {
    if (!autoReply || !cur) return
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
        <motion.div className="aipanel no-drag" {...pop} role="region" aria-live="polite">
          <div className="aipanel-body">
            {error
              ? <div className="ai-error"><span>{error}</span>{/Réglages/.test(error) && <button className="btn quiet" onClick={() => { clear(); useUi.getState().openSettings('ai') }}><Settings size={13} /> Ouvrir les réglages</button>}</div>
              : frag
                ? <span>{frag.base.slice(0, frag.start)}<mark className={`ai-frag ${streaming ? 'cursor' : ''}`}>{shown}</mark>{frag.base.slice(frag.end)}</span>
              : settled && output
                ? <>
                    {sel
                      ? <div className="ai-selview" onClick={() => { setSel(null); setTimeout(() => editRef.current?.focus(), 10) }}>{output.slice(0, sel.start)}<mark className="ai-sel">{sel.text}</mark>{output.slice(sel.end)}</div>
                      : <textarea ref={editRef} className="ai-edit" value={output} spellCheck onChange={(e) => setOutput(e.target.value)} onMouseUp={onSelect} onKeyUp={(e) => { if (e.shiftKey || e.key === 'Shift') onSelect() }} />}
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
            <span className="grow">{AI_TASK_LABELS[task]}{tool && <> · consulte <b>{tool}</b></>}</span>
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
            <button className="icon-btn" aria-label="Fermer" onClick={clear}><X size={15} /></button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}