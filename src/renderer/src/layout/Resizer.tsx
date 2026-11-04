import { useRef } from 'react'

export function Resizer({ cssVar, min, max }: { cssVar: string; min: number; max: number }) {
  const start = useRef<{ x: number; w: number } | null>(null)
  const onDown = (e: React.MouseEvent) => {
    const w = parseInt(getComputedStyle(document.documentElement).getPropertyValue(cssVar)) || min
    start.current = { x: e.clientX, w }
    const move = (ev: MouseEvent) => {
      if (!start.current) return
      const next = Math.min(max, Math.max(min, start.current.w + ev.clientX - start.current.x))
      document.documentElement.style.setProperty(cssVar, `${next}px`)
    }
    const up = () => { start.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }
  return <div className="resizer" onMouseDown={onDown} />
}
