// src/renderer/src/features/ai/AiBar.tsx
import { useState } from 'react'
import { Sparkles, AlignLeft, PenLine, ArrowUp } from 'lucide-react'
import { useAi } from '@/stores/ai.store'
import { useAiOnThread } from './useAi'
import { useMail } from '@/stores/mail.store'

export function AiBar() {
  const settings = useAi((s) => s.settings)
  const task = useAi((s) => s.task)
  const streaming = useAi((s) => s.streaming)
  const output = useAi((s) => s.output)
  const cur = useMail((s) => s.current)
  const run = useAi((s) => s.run)
  const { trigger, available } = useAiOnThread()
  const [prompt, setPrompt] = useState('')
  if (!settings?.enabled || !available) return null
  const WRITE = /^(r[ée]ponds?|r[ée]dige|[ée]cris|dis(-| )(lui|leur)|propose|accepte|refuse|demande|confirme|relance|remercie|d[ée]cline|annonce|explique(-| )(lui|leur)|informe)/i
  const ask = () => {
    const p = prompt.trim()
    if (!p || streaming || !cur) return
    setPrompt('')
    // une réponse est déjà affichée : la consigne la modifie
    if (output && (task === 'reply' || task === 'rewrite')) { void run({ task: 'rewrite', accountId: cur.thread.accountId, threadId: cur.thread.id, selection: output, userPrompt: p }); return }
    trigger(WRITE.test(p) ? 'reply' : 'chat', p)
  }
  return (
    <div className="aibar no-drag" role="toolbar" aria-label="Assistant">
      <button className={`verb ${task === 'summarize' ? 'on' : ''}`} onClick={() => trigger('summarize')}><AlignLeft size={14} /> Résumer</button>
      <button className={`verb ${task === 'reply' ? 'on' : ''}`} onClick={() => trigger('reply')}><PenLine size={14} /> Rédiger une réponse</button>
      <span className="sep" />
      <Sparkles size={14} style={{ color: 'var(--text-3)', marginLeft: 6 }} />
      <input value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} placeholder={output && (task === 'reply' || task === 'rewrite') ? 'Modifier cette réponse : plus court, plus chaleureux, en anglais…' : 'Demander quelque chose sur ce fil'} />
      <button className="verb" aria-label="Envoyer" disabled={!prompt.trim()} style={{ padding: '0 10px', opacity: prompt.trim() ? 1 : 0.4 }} onClick={ask}><ArrowUp size={15} /></button>
    </div>
  )
}