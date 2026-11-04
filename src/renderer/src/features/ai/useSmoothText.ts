// src/renderer/src/features/ai/useSmoothText.ts
import { useEffect, useRef, useState } from 'react'

// Révèle `target` progressivement : vitesse de base ~90 caractères/s, accélère si le retard dépasse 80 caractères.
export function useSmoothText(target: string, active: boolean): string {
  const [shown, setShown] = useState(target)
  const shownRef = useRef(target)
  const raf = useRef<number | null>(null)
  const last = useRef(0)

  useEffect(() => {
    if (!active) { shownRef.current = target; setShown(target); return }
    if (!target.startsWith(shownRef.current)) { shownRef.current = ''; setShown('') }
    const step = (t: number) => {
      const dt = Math.min(64, t - (last.current || t)); last.current = t
      const cur = shownRef.current
      const backlog = target.length - cur.length
      if (backlog > 0) {
        const rate = backlog > 80 ? 90 + (backlog - 80) * 3 : 90
        const n = Math.max(1, Math.round((rate * dt) / 1000))
        shownRef.current = target.slice(0, cur.length + n)
        setShown(shownRef.current)
      }
      raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => { if (raf.current) cancelAnimationFrame(raf.current); last.current = 0 }
  }, [target, active])

  useEffect(() => { if (!active) { shownRef.current = target; setShown(target) } }, [active, target])
  return shown
}