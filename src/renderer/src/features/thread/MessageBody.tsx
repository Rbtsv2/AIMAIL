// src/renderer/src/features/thread/MessageBody.tsx
import { useEffect, useRef, useState } from 'react'
import { ImageOff } from 'lucide-react'
import DOMPurify from 'dompurify'
import type { Message } from '@shared/models/Message'

const FRAME_CSS = `<style>html,body{height:auto!important;min-height:0!important;overflow:hidden}html{padding:0}body{margin:0;padding:18px 22px;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1d1d1f;word-wrap:break-word;overflow-wrap:anywhere}img{max-width:100%;height:auto}blockquote{border-left:2px solid #c7c7cc;margin:8px 0;padding-left:12px;color:#6e6e73}a{color:#4f6bed}pre{white-space:pre-wrap}table{max-width:100%}</style>`

export function MessageBody({ m }: { m: Message }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [h, setH] = useState(120)
  const [ready, setReady] = useState(false)
  const [unblocked, setUnblocked] = useState(false)
  const blocked = !!m.bodyHtml && /data-blocked-src=/.test(m.bodyHtml)

  useEffect(() => {
    const f = ref.current
    if (!f || !m.bodyHtml) return
    let html = DOMPurify.sanitize(m.bodyHtml, { WHOLE_DOCUMENT: false })
    if (unblocked) html = html.replace(/data-blocked-src="([^"]+)" src=""/g, 'src="$1"')
    f.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">${FRAME_CSS}</head><body>${html}</body></html>`
    const onLoad = () => {
      const d = f.contentDocument
      if (!d) return
      const fit = () => {
        const b = d.body
        const content = Math.max(b.scrollHeight, b.offsetHeight, Math.ceil(b.getBoundingClientRect().height))
        setH(Math.min(Math.max(content, 40), 20000))
      }
      fit()
      setReady(true)
      const ro = new ResizeObserver(fit); ro.observe(d.body)
      d.querySelectorAll('img').forEach((img) => { img.addEventListener('load', fit); img.addEventListener('error', fit) })
      setTimeout(fit, 300); setTimeout(fit, 1500)
      d.addEventListener('click', (e) => { const a = (e.target as HTMLElement).closest('a'); if (a?.href) { e.preventDefault(); window.open(a.href) } })
    }
    f.addEventListener('load', onLoad)
    return () => f.removeEventListener('load', onLoad)
  }, [m.bodyHtml, unblocked])

  if (!m.bodyFetched) return <div className="msg-body"><div className="skeleton" style={{ width: '60%', marginBottom: 8 }} /><div className="skeleton" style={{ width: '90%', marginBottom: 8 }} /><div className="skeleton" style={{ width: '40%' }} /></div>
  if (!m.bodyHtml) return <div className="msg-body"><div className="msg-text">{m.bodyText}</div></div>
  return (
    <>
      {blocked && !unblocked && <div className="blocked-images"><ImageOff size={14} /> Images distantes masquées <button className="btn quiet" style={{ height: 24 }} onClick={() => setUnblocked(true)}>Afficher</button></div>}
      <div className="msg-body"><div className="msg-frame"><iframe ref={ref} sandbox="allow-same-origin allow-popups" title="message" style={{ height: h, opacity: ready ? 1 : 0, transition: 'opacity 180ms var(--ease)' }} /></div></div>
    </>
  )
}