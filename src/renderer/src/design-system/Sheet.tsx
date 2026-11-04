// src/renderer/src/design-system/Sheet.tsx
import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { sheetMotion, fade } from './motion'
import { IconButton } from './IconButton'

interface Props { open: boolean; onClose: () => void; title?: ReactNode; variant?: 'center' | 'compose' | 'page'; head?: ReactNode; children: ReactNode }
export function Sheet({ open, onClose, title, variant = 'center', head, children }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {variant === 'center' && <motion.div className="sheet-backdrop" {...fade} onClick={onClose} />}
          <motion.div className={`sheet ${variant}`} {...(variant === 'page' ? fade : sheetMotion)} role="dialog" aria-modal>
            <div className="sheet-head">
              <span>{title}</span>
              <div className="grow" />
              {head}
              <IconButton label="Fermer" onClick={onClose}><X size={16} /></IconButton>
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}