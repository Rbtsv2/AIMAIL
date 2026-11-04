// src/renderer/src/features/inbox/ThreadList.tsx
import { useMail } from '@/stores/mail.store'
import { useAccounts } from '@/stores/accounts.store'
import { ThreadRow } from './ThreadRow'
import { ThreadListToolbar } from './ThreadListToolbar'
import { useInfiniteThreads } from './useThreads'
import { RowSkeleton } from '@/design-system/Skeleton'
import { Resizer } from '@/layout/Resizer'
import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ThreadMenu, type ThreadMenuState } from './ThreadMenu'

export function ThreadList() {
  const threads = useMail((s) => s.threads)
  const loading = useMail((s) => s.loading)
  const selectedId = useMail((s) => s.selectedId)
  const view = useMail((s) => s.view)
  const multi = useAccounts((s) => s.accounts.length > 1)
  const ref = useInfiniteThreads()
  const [menu, setMenu] = useState<ThreadMenuState>(null)
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const startRef = useRef<{ x: number; y: number; base: string[]; additive: boolean } | null>(null)

  // sélection au lasso : départ sur le bord gauche d'une ligne, sur une zone vide, ou avec Maj
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('.row-actions, button, input')) return
    const row = target.closest<HTMLElement>('.row')
    const leftEdge = row ? e.clientX - row.getBoundingClientRect().left < 26 : false
    if (row && !leftEdge && !e.shiftKey) return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const base = e.ctrlKey || e.metaKey ? [...useMail.getState().selection] : []
    startRef.current = { x: e.clientX - r.left, y: e.clientY - r.top + el.scrollTop, base, additive: e.ctrlKey || e.metaKey }
    e.preventDefault()
    const move = (ev: PointerEvent) => {
      const st = startRef.current
      if (!st) return
      const rr = el.getBoundingClientRect()
      const cx = ev.clientX - rr.left, cy = ev.clientY - rr.top + el.scrollTop
      const x = Math.min(st.x, cx), y = Math.min(st.y, cy), w = Math.abs(cx - st.x), h = Math.abs(cy - st.y)
      setBox({ x, y, w, h })
      if (ev.clientY > rr.bottom - 24) el.scrollTop += 8; else if (ev.clientY < rr.top + 24) el.scrollTop -= 8
      const hit: string[] = []
      el.querySelectorAll<HTMLElement>('.row[data-thread]').forEach((n) => {
        const b = n.getBoundingClientRect()
        const top = b.top - rr.top + el.scrollTop, bottom = top + b.height
        if (bottom >= y && top <= y + h) hit.push(n.dataset.thread!)
      })
      const sel = st.additive ? [...new Set([...st.base, ...hit])] : hit
      useMail.setState({ selection: sel, selectedId: sel.length === 1 ? sel[0] : null, anchorId: hit[0] ?? null })
    }
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
      const st = startRef.current; startRef.current = null
      setBox(null)
      const sel = useMail.getState().selection
      if (st && sel.length === 1) void useMail.getState().select(sel[0])
      else if (sel.length === 0 && !st?.additive) void useMail.getState().select(null)
      document.body.classList.remove('lasso')
    }
    document.body.classList.add('lasso')
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  return (
    <section className="list" style={{ position: 'relative' }}>
      <ThreadListToolbar />
      <div className="list-scroll" ref={ref} role="listbox" onPointerDown={onPointerDown} style={{ position: 'relative' }}>
        {box && <div className="lasso-box" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} />}
        <AnimatePresence initial={false}>
          {threads.map((t) => (
            <motion.div key={t.id} layout="position" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0, x: -24 }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }} style={{ overflow: 'hidden' }}>
              <ThreadRow t={t} selected={t.id === selectedId} showAccount={multi && !view.accountId} onContext={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, t }) }} />
            </motion.div>
          ))}
        </AnimatePresence>
        {loading && threads.length === 0 && <><RowSkeleton /><RowSkeleton /><RowSkeleton /><RowSkeleton /></>}
        {!loading && threads.length === 0 && <div className="empty" style={{ height: 240 }}><div><h3>Rien ici</h3><p>Aucun message dans cette vue.</p></div></div>}
      </div>
      <Resizer cssVar="--list-w" min={280} max={520} />
      <ThreadMenu menu={menu} onClose={() => setMenu(null)} />
    </section>
  )
}