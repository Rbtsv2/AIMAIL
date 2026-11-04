import { AnimatePresence, motion } from 'framer-motion'
import { useUi } from '@/stores/ui.store'
import { pop } from './motion'

export function Toasts() {
  const toasts = useUi((s) => s.toasts)
  return (
    <div className="toasts">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} className="toast" {...pop} layout>
            <span>{t.text}</span>
            {t.action && <button onClick={t.action.fn}>{t.action.label}</button>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
