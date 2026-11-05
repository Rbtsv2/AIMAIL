// src/renderer/src/design-system/SigFrame.tsx
// Rendu isolé d'une signature HTML (styles de l'application non hérités), hauteur ajustée au contenu.
import { useRef } from 'react'

export function SigFrame({ html, className }: { html: string; className?: string }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const light = (document.documentElement.getAttribute('data-compose-surface') ?? 'light') === 'light'
  const cs = getComputedStyle(document.documentElement)
  const bg = light ? '#fff' : cs.getPropertyValue('--surface').trim() || '#1c1c1e'
  const pad = '0 0 6px'   // aligné sur le bord gauche du texte
  const fg = light ? '#1d1d1f' : cs.getPropertyValue('--text').trim() || '#f5f5f7'
  const fit = () => { const f = ref.current; const h = f?.contentDocument?.documentElement?.scrollHeight; if (f && h) f.style.height = `${h + 2}px` }
  return <iframe ref={ref} className={className ?? 'ai-sig-frame'} title="signature" sandbox="allow-same-origin" onLoad={fit}
    srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:${bg}}body{padding:${pad};font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;font-size:15px;color:${fg}}img{max-width:100%}img[width]{max-width:none}</style></head><body>${html}</body></html>`} />
}