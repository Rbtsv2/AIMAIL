// src/renderer/src/design-system/Confirm.tsx
// Boîte de confirmation générique (promesse) : useUi.getState().confirm({ title, body, okLabel, danger })
import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { useUi } from '@/stores/ui.store'

export function ConfirmDialog() {
  const req = useUi((s) => s.confirmReq)
  useEffect(() => {
    if (!req) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); req.resolve(true) } if (e.key === 'Escape') { e.preventDefault(); req.resolve(false) } }
    window.addEventListener('keydown', h, true)
    return () => window.removeEventListener('keydown', h, true)
  }, [req])
  return (
    <AnimatePresence>
      {req && (
        <motion.div className="confirm-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => req.resolve(false)}>
          <motion.div className="confirm-card" role="alertdialog" aria-modal="true" initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.98 }} transition={{ type: 'spring', stiffness: 420, damping: 32 }} onMouseDown={(e) => e.stopPropagation()}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{req.danger && <AlertTriangle size={16} style={{ color: '#d9822b' }} />}{req.title}</h3>
            {req.body && <p className="confirm-excerpt" style={{ marginTop: 0 }}>{req.body}</p>}
            <div className={`confirm-actions ${((req.okLabel ?? '').length + (req.cancelLabel ?? '').length) > 34 ? 'stacked' : ''}`}>
              <button className="btn quiet" onClick={() => req.resolve(false)}>{req.cancelLabel ?? 'Annuler'} <kbd>Échap</kbd></button>
              <button className={`btn ${req.danger ? 'danger-solid' : 'primary'}`} autoFocus onClick={() => req.resolve(true)}>{req.okLabel ?? 'Confirmer'} <kbd>↵</kbd></button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}