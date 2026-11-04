// src/renderer/src/features/compose/Composer.tsx
import { useState } from 'react'
import { Paperclip, Send, Sparkles, Trash2, X, Image as ImageIcon } from 'lucide-react'
import type { Editor as TiptapEditor } from '@tiptap/react'
import { useCompose, isComposeWindow } from '@/stores/compose.store'
import { useAccounts } from '@/stores/accounts.store'
import { useAi } from '@/stores/ai.store'
import { Sheet } from '@/design-system/Sheet'
import { RecipientInput } from './RecipientInput'
import { SignaturePicker } from './SignaturePicker'
import { Editor } from './Editor'
import { useAutosave, draftIsEmpty } from './useDraft'
import { useSmoothText } from '@/features/ai/useSmoothText'
import { shrinkImage } from '@/lib/image'
import { invoke } from '@/lib/api'
import { AnimatePresence, motion } from 'framer-motion'
import { pop } from '@/design-system/motion'

export function Composer() {
  const draft = useCompose((s) => s.draft)
  const update = useCompose((s) => s.update)
  const close = useCompose((s) => s.close)
  const send = useCompose((s) => s.send)
  const accounts = useAccounts((s) => s.accounts)
  const ai = useAi()
  const [showCc, setShowCc] = useState(false)
  const [selection, setSelection] = useState('')
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiOpen, setAiOpen] = useState(false)
  const [editor, setEditor] = useState<TiptapEditor | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const aiShown = useSmoothText(ai.output, ai.streaming)
  useAutosave()
  const insertImage = async () => { const raw = await invoke('compose:pickImage'); if (raw && editor) editor.chain().focus().setImage({ src: await shrinkImage(raw) }).run() }

  const canSend = !!draft && draft.to.length > 0
  const runAi = (task: 'rewrite' | 'reply' | 'translate', userPrompt?: string) => {
    if (!draft) return
    void ai.run({ task, accountId: draft.accountId, threadId: draft.threadId ?? undefined, selection: selection || undefined, draftHtml: draft.html, userPrompt })
  }
  const applyAi = () => {
    if (!draft || !ai.output) return
    const html = ai.output.split(/\n{2,}/).map((p) => `<p>${p.replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>`).join('')
    if (selection && draft.html.includes(selection)) update({ html: draft.html.replace(selection, ai.output) })
    else {
      const q = draft.html.indexOf('<div style="color:#6e6e73')
      update({ html: q >= 0 ? html + draft.html.slice(q) : html })
    }
    ai.clear(); setAiOpen(false)
  }

  const title = draft?.mode === 'new' ? 'Nouveau message' : draft?.mode === 'forward' ? 'Transférer' : 'Répondre'
  return (
    <Sheet open={!!draft} onClose={() => void close()} variant={isComposeWindow() ? 'page' : 'compose'} title={title}
      head={draft && accounts.length > 1 && (
        <select className="field" style={{ height: 28, minWidth: 160, fontWeight: 400 }} value={draft.accountId} onChange={(e) => update({ accountId: e.target.value })}>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.email}</option>)}
        </select>
      )}>
      {draft && (
        <>
          <div className="compose-fields">
            <RecipientInput label="À" value={draft.to} onChange={(to) => update({ to })} autoFocus={draft.mode === 'new'} />
            {(showCc || draft.cc.length > 0 || draft.bcc.length > 0) && <>
              <RecipientInput label="Cc" value={draft.cc} onChange={(cc) => update({ cc })} />
              <RecipientInput label="Cci" value={draft.bcc} onChange={(bcc) => update({ bcc })} />
            </>}
            <div className="compose-row">
              <span className="k">Objet</span>
              <input value={draft.subject} onChange={(e) => update({ subject: e.target.value })} placeholder="Objet" autoFocus={draft.mode !== 'new'} />
              {!showCc && !draft.cc.length && <button className="btn quiet" style={{ height: 24, color: 'var(--text-2)' }} onClick={() => setShowCc(true)}>Cc / Cci</button>}
            </div>
          </div>
          <Editor html={draft.html} onChange={(html, text) => update({ html, text })} onSelection={setSelection} onReady={setEditor} />
          {draft.attachmentPaths.length > 0 && (
            <div className="msg-atts" style={{ padding: '8px 20px 0' }}>
              {draft.attachmentPaths.map((p) => <span key={p} className="att"><Paperclip size={13} /><span className="n">{p.split(/[\\/]/).pop()}</span><button className="icon-btn" style={{ width: 20, height: 20 }} onClick={() => update({ attachmentPaths: draft.attachmentPaths.filter((x) => x !== p) })}><X size={12} /></button></span>)}
            </div>
          )}
          <AnimatePresence>
            {aiOpen && (
              <motion.div {...pop} style={{ borderTop: '1px solid var(--hairline)', padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="btn quiet" onClick={() => runAi('reply')}>Rédiger une réponse</button>
                  <button className="btn quiet" onClick={() => runAi('rewrite', 'Rends le texte plus court.')}>Plus court</button>
                  <button className="btn quiet" onClick={() => runAi('rewrite', 'Rends le texte plus formel.')}>Plus formel</button>
                  <button className="btn quiet" onClick={() => runAi('rewrite', 'Corrige l’orthographe et la grammaire sans changer le ton.')}>Corriger</button>
                  <button className="btn quiet" onClick={() => runAi('translate', 'Traduis en anglais.')}>En anglais</button>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="field" style={{ flex: 1 }} placeholder={selection ? 'Que faire avec la sélection ?' : 'Consigne libre pour l’assistant'} value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && aiPrompt.trim()) { runAi('rewrite', aiPrompt.trim()); setAiPrompt('') } }} />
                </div>
                {(ai.output || ai.streaming || ai.error) && (
                  <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: 12, maxHeight: 180, overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: 'var(--fs-sm)', userSelect: 'text' }}>
                    {ai.error ? <span className="err">{ai.error}</span> : <span className={ai.streaming || aiShown !== ai.output ? 'cursor' : ''}>{aiShown}</span>}
                    {!ai.streaming && ai.output && <div style={{ marginTop: 8, display: 'flex', gap: 6 }}><button className="btn primary" onClick={applyAi}>{selection ? 'Remplacer la sélection' : 'Utiliser ce texte'}</button><button className="btn quiet" onClick={ai.clear}>Ignorer</button></div>}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="compose-foot">
            <button className="btn primary" disabled={!canSend} onClick={() => void send()}><Send size={14} /> Envoyer</button>
            <div className="grow">
              <button className={`icon-btn ${aiOpen ? 'on' : ''}`} aria-label="Assistant" title="Assistant IA" onClick={() => setAiOpen((v) => !v)}><Sparkles size={16} /></button>
              <button className="icon-btn" aria-label="Insérer une image" title="Insérer une image" onClick={() => void insertImage()}><ImageIcon size={16} /></button>
              <button className="icon-btn" aria-label="Joindre un fichier" title="Joindre" onClick={async () => { const f = await invoke('compose:pickAttachments'); if (f.length) update({ attachmentPaths: [...draft.attachmentPaths, ...f] }) }}><Paperclip size={16} /></button>
              <SignaturePicker accountId={draft.accountId} value={draft.signatureId} onChange={(signatureId) => update({ signatureId })} />
            </div>
            <button className="icon-btn" aria-label="Supprimer le brouillon" onClick={async () => { if (draftIsEmpty(draft)) { await invoke('drafts:delete', draft.id); useCompose.setState({ draft: null }); if (isComposeWindow()) window.api.closeSelf() } else setConfirmDiscard(true) }}><Trash2 size={16} /></button>
          </div>
          {confirmDiscard && (
            <div className="confirm" onClick={() => setConfirmDiscard(false)}>
              <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
                <div className="confirm-icon"><Trash2 size={22} /></div>
                <h3>Abandonner ce message ?</h3>
                <p>Gardez-le dans Brouillons pour le reprendre plus tard, ou supprimez-le définitivement.</p>
                <div className="actions">
                  <button className="btn primary" onClick={() => void close()}>Garder en brouillon</button>
                  <button className="btn danger" onClick={async () => { await invoke('drafts:delete', draft.id); useCompose.setState({ draft: null }); if (isComposeWindow()) window.api.closeSelf() }}>Supprimer</button>
                  <button className="btn quiet" onClick={() => setConfirmDiscard(false)}>Continuer la rédaction</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </Sheet>
  )
}