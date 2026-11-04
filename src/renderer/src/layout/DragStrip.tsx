// src/renderer/src/layout/DragStrip.tsx
import { useEffect } from 'react'
import { api, isMac } from '@/lib/api'

const DRAG_ZONES = '.sidebar-top, .list-head, .pane-head, .titlebar, .onboard-bar, .drag'
const INTERACTIVE = 'button, input, select, textarea, a, [role="button"], .no-drag, .resizer, .win-controls'

export function DragStrip() {
  useEffect(() => {
    if (isMac) return
    let dragging = false
    const down = (e: MouseEvent) => {
      if (e.button !== 0) return
      const t = e.target as HTMLElement
      if (!t.closest(DRAG_ZONES) || t.closest(INTERACTIVE)) return
      if (e.detail === 2) { api.toggleMaximize(); return }
      dragging = true
      api.dragStart()
    }
    const up = () => { if (dragging) { dragging = false; api.dragEnd() } }
    document.addEventListener('mousedown', down, true)
    window.addEventListener('mouseup', up)
    window.addEventListener('blur', up)
    return () => {
      document.removeEventListener('mousedown', down, true)
      window.removeEventListener('mouseup', up)
      window.removeEventListener('blur', up)
    }
  }, [])
  return null
}