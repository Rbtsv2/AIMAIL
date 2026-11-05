// src/renderer/src/lib/dnd.tsx
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { Folder, Mail } from 'lucide-react'

export type DragPayload = { kind: 'folder' | 'thread' | 'threads' | 'account'; id: string; ids?: string[]; label: string; count?: number; accountId?: string }

export type DropLine = { top: number; left: number; width: number } | null
export type Resolved = { hover: string | null; line: DropLine }

interface DndState {
  payload: DragPayload | null
  x: number; y: number
  hover: string | null
  line: DropLine
  lifted: boolean
  set(p: Partial<DndState>): void
}
export const useDnd = create<DndState>((set) => ({ payload: null, x: 0, y: 0, hover: null, line: null, lifted: false, set: (p) => set(p) }))

let dropHandler: ((payload: DragPayload, targetFolderId: string) => void) | null = null
export const onDrop = (fn: typeof dropHandler) => { dropHandler = fn }
let resolver: ((x: number, y: number, payload: DragPayload) => Resolved | null) | null = null
export const setResolver = (fn: typeof resolver) => { resolver = fn }

let suppressClickUntil = 0
export const clickSuppressed = (): boolean => Date.now() < suppressClickUntil

export function beginDrag(e: React.PointerEvent, payload: DragPayload): void {
  if (e.button !== 0) return
  const sx = e.clientX, sy = e.clientY
  let started = false
  const move = (ev: PointerEvent) => {
    if (!started) {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return
      started = true
      useDnd.getState().set({ payload, x: ev.clientX, y: ev.clientY, hover: null, line: null, lifted: false })
      requestAnimationFrame(() => useDnd.getState().set({ lifted: true }))
      document.body.classList.add('dragging')
    }
    const r = resolver?.(ev.clientX, ev.clientY, payload)
    if (r) { useDnd.getState().set({ x: ev.clientX, y: ev.clientY, hover: r.hover, line: r.line }); return }
    const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-drop-folder]')
    const target = el?.dataset.dropFolder ?? null
    // un message ne peut pas changer de compte : les dossiers des autres comptes sont des cibles interdites
    const foreign = !!target && !!payload.accountId && !!el?.dataset.dropAccount && el.dataset.dropAccount !== payload.accountId && (payload.kind === 'thread' || payload.kind === 'threads')
    const valid = target && !foreign && !(payload.kind === 'folder' && target === payload.id)
    document.body.classList.toggle('drop-forbidden', foreign)
    useDnd.getState().set({ x: ev.clientX, y: ev.clientY, hover: valid ? target : null, line: null })
  }
  const up = () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('keydown', esc)
    document.body.classList.remove('dragging'); document.body.classList.remove('drop-forbidden')
    if (!started) return
    suppressClickUntil = Date.now() + 250
    const { hover } = useDnd.getState()
    if (hover && dropHandler) dropHandler(payload, hover)
    useDnd.getState().set({ payload: null, hover: null, line: null, lifted: false })
  }
  const esc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { started = false; up() } }
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('keydown', esc)
}

export function DropIndicator() {
  const line = useDnd((s) => s.line)
  if (!line) return null
  return <div className="drop-line" style={{ top: line.top, left: line.left, width: line.width }} />
}

export function DragGhost() {
  const payload = useDnd((s) => s.payload)
  const x = useDnd((s) => s.x), y = useDnd((s) => s.y)
  const hover = useDnd((s) => s.hover)
  const lifted = useDnd((s) => s.lifted)
  const [shown, setShown] = useState(false)
  useEffect(() => { setShown(!!payload) }, [payload])
  if (!payload || !shown) return null
  const Icon = payload.kind === 'folder' ? Folder : Mail
  return (
    <div className={`drag-ghost ${lifted ? 'lifted' : ''} ${hover ? 'over' : ''}`} style={{ transform: `translate(${x + 14}px, ${y - 18}px)` }}>
      <Icon size={14} />
      <span>{payload.label}</span>
      {!!payload.count && payload.count > 1 && payload.kind !== 'threads' && <em>{payload.count}</em>}
    </div>
  )
}