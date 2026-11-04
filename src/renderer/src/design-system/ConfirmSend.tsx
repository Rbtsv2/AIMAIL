// src/renderer/src/design-system/ConfirmSend.tsx
// Confirmation avant envoi : destinataires, objet, pièces jointes, extrait — Entrée confirme, Échap annule.
import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Send, Paperclip, AlertTriangle } from 'lucide-react'
import type { Draft } from '@shared/models/Draft'
import { useUi } from '@/stores/ui.store'

export function ConfirmSend() {
  const req = useUi((s) => s.confirmSend)
  useEffect(() => {
    if (!req) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); req.resolve(true) } if (e.key === 'Escape') { e.preventDefault(); req.resolve(false) } }
    window.addEventListener('keydown', h, true)
    return () => window.removeEventListener('keydown', h, true)
  }, [req])
  const d: Draft | undefined = req?.draft
  const text = d ? d.html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : ''
  const warnings: string[] = []
  if (d && !d.subject.trim()) warnings.push('Objet vide')
  if (d && /pi[èe]ce[s]? jointe|ci-joint|attach/i.test(text) && !d.attachmentPaths.length) warnings.push('Le texte mentionne une pièce jointe, mais il n’y en a aucune')
  if (d && !text) warnings.push('Message vide')
  return (
    <AnimatePresence>
      {req && d && (
        <motion.div className="confirm-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => req.resolve(false)}>
          <motion.div className="confirm-card" role="dialog" aria-modal="true" initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.98 }} transition={{ type: 'spring', stiffness: 420, damping: 32 }} onMouseDown={(e) => e.stopPropagation()}>
            <h3>Envoyer ce message ?</h3>
            <div className="confirm-rows">
              <div className="confirm-row"><span>À</span><strong>{d.to.map((a) => a.name ? `${a.name} <${a.address}>` : a.address).join(', ') || '—'}</strong></div>
              {d.cc.length > 0 && <div className="confirm-row"><span>Cc</span><strong>{d.cc.map((a) => a.address).join(', ')}</strong></div>}
              {d.bcc.length > 0 && <div className="confirm-row"><span>Cci</span><strong>{d.bcc.map((a) => a.address).join(', ')}</strong></div>}
              <div className="confirm-row"><span>Objet</span><strong>{d.subject.trim() || <em>sans objet</em>}</strong></div>
              {d.attachmentPaths.length > 0 && <div className="confirm-row"><span><Paperclip size={12} /></span><strong>{d.attachmentPaths.length} pièce{d.attachmentPaths.length > 1 ? 's' : ''} jointe{d.attachmentPaths.length > 1 ? 's' : ''}</strong></div>}
            </div>
            {text && <p className="confirm-excerpt">{text.slice(0, 220)}{text.length > 220 ? '…' : ''}</p>}
            {warnings.length > 0 && <div className="confirm-warn"><AlertTriangle size={14} /> {warnings.join(' · ')}</div>}
            <div className="confirm-actions">
              <button className="btn quiet" onClick={() => req.resolve(false)}>Annuler <kbd>Échap</kbd></button>
              <button className="btn primary" autoFocus onClick={() => req.resolve(true)}><Send size={14} /> Envoyer <kbd>↵</kbd></button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}