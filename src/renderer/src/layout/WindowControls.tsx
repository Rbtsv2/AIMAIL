// src/renderer/src/layout/WindowControls.tsx
import { useEffect, useState } from 'react'
import { Minus, Square, Copy, X } from 'lucide-react'
import { api } from '@/lib/api'

export function WindowControls() {
  const [max, setMax] = useState(false)
  useEffect(() => {
    if (api.platform !== 'linux') return
    const refresh = () => void api.isMaximized().then((m) => { setMax(m); document.body.classList.toggle('maximized', m) })
    refresh()
    window.addEventListener('resize', refresh)
    return () => window.removeEventListener('resize', refresh)
  }, [])
  if (api.platform !== 'linux' || !window.api.customControls) return null
  return (
    <div className="win-controls no-drag" role="group" aria-label="Fenêtre" onMouseDown={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <button aria-label="Réduire" onClick={() => api.minimize()}><Minus size={14} /></button>
      <button aria-label={max ? 'Restaurer' : 'Agrandir'} onClick={() => api.toggleMaximize()}>{max ? <Copy size={12} /> : <Square size={12} />}</button>
      <button className="close" aria-label="Fermer" onClick={() => api.closeWindow()}><X size={15} /></button>
    </div>
  )
}