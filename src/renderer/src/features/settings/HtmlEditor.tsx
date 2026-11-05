// src/renderer/src/features/settings/HtmlEditor.tsx
// Édition WYSIWYG fidèle : le HTML est rendu tel quel dans un cadre isolé et édité en place (tableaux, styles et images conservés).
import { useEffect, useRef, useState } from 'react'
import { Bold, Italic, Underline, Link2, Image as ImageIcon, Eraser, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Table2, Minus } from 'lucide-react'
import { invoke } from '@/lib/api'
import { shrinkImage } from '@/lib/image'

export function HtmlEditor({ html, onChange }: { html: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const last = useRef(html)

  useEffect(() => {
    const f = ref.current
    if (!f) return
    f.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}body{padding:14px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;font-size:15px;color:#1d1d1f;outline:none;min-height:120px}img{max-width:100%}body:focus{outline:none}img.sel{outline:2px solid #4f6bed;outline-offset:2px}</style></head><body contenteditable="true" spellcheck="true">${html}</body></html>`
    const onLoad = () => {
      const d = f.contentDocument
      if (!d) return
      setReady(true)
      d.execCommand('styleWithCSS', false, 'true')
      const emit = () => { const h = d.body.innerHTML; if (h !== last.current) { last.current = h; onChange(h) } }
      d.body.addEventListener('input', emit)
      d.body.addEventListener('blur', emit)
      d.body.addEventListener('click', (e) => { d.querySelectorAll('img.sel').forEach((i) => i.classList.remove('sel')); const t = e.target as HTMLElement; if (t.tagName === 'IMG') t.classList.add('sel') })
      d.body.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'b') { e.preventDefault(); d.execCommand('bold') } if ((e.metaKey || e.ctrlKey) && e.key === 'i') { e.preventDefault(); d.execCommand('italic') } })
      // liens : ouverture externe au Ctrl/Cmd+clic seulement, sinon édition
      d.body.addEventListener('click', (e) => { const a = (e.target as HTMLElement).closest('a'); if (a && (e.metaKey || e.ctrlKey)) { e.preventDefault(); window.open(a.href) } else if (a) e.preventDefault() })
    }
    f.addEventListener('load', onLoad)
    return () => f.removeEventListener('load', onLoad)
    // volontairement sans dépendance à html : le cadre est la source de vérité pendant l'édition
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const doc = () => ref.current?.contentDocument
  // sélection mémorisée avant qu'un contrôle natif (sélecteur de couleur, liste) ne prenne le focus
  const savedRange = useRef<Range | null>(null)
  const saveSel = () => { const d = doc(); const sel = d?.getSelection(); if (sel && sel.rangeCount) savedRange.current = sel.getRangeAt(0).cloneRange() }
  const restoreSel = () => { const d = doc(); const sel = d?.getSelection(); if (d && sel && savedRange.current) { sel.removeAllRanges(); sel.addRange(savedRange.current) } }
  // couleur en direct : un span posé sur la sélection au premier mouvement, puis mis à jour à chaque mouvement (le focus reste au sélecteur)
  const colorSpan = useRef<HTMLSpanElement | null>(null)
  const beginColor = () => { saveSel(); colorSpan.current = null }
  const applyColor = (color: string) => {
    const d = doc(); if (!d) return
    if (!colorSpan.current) {
      const r = savedRange.current; if (!r || r.collapsed) return
      const span = d.createElement('span')
      span.appendChild(r.extractContents()); r.insertNode(span)
      colorSpan.current = span
      const nr = d.createRange(); nr.selectNodeContents(span); savedRange.current = nr
    }
    colorSpan.current.style.color = color
    onChange(d.body.innerHTML); last.current = d.body.innerHTML
  }
  const cmd = (c: string, v?: string) => { const d = doc(); if (!d) return; d.body.focus(); restoreSel(); try { d.execCommand('styleWithCSS', false, 'true') } catch {} d.execCommand(c, false, v); onChange(d.body.innerHTML); last.current = d.body.innerHTML }
  const link = () => { const d = doc(); if (!d) return; const cur = d.getSelection()?.anchorNode?.parentElement?.closest('a')?.getAttribute('href') ?? 'https://'; const url = prompt('Adresse du lien', cur); if (url === null) return; if (!url) cmd('unlink'); else cmd('createLink', url) }
  const replaceImage = async () => {
    const d = doc(); if (!d) return
    const img = d.querySelector<HTMLImageElement>('img.sel') ?? d.querySelector<HTMLImageElement>('img')
    const raw = await invoke('compose:pickImage'); if (!raw) return
    const src = await shrinkImage(raw, 400)
    if (img) { img.src = src } else d.execCommand('insertImage', false, src)
    onChange(d.body.innerHTML); last.current = d.body.innerHTML
  }

  return (
    <div className="html-editor">
      <div className="he-bar">
        <select className="he-select" defaultValue="" onPointerDown={saveSel} onChange={(e) => { if (e.target.value) cmd('fontName', e.target.value); e.target.value = '' }} title="Police">
          <option value="">Police</option>
          {['Arial', 'Helvetica', 'Verdana', 'Tahoma', 'Georgia', 'Times New Roman', 'Trebuchet MS', 'Calibri', 'Segoe UI'].map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
        </select>
        <select className="he-select" defaultValue="" onPointerDown={saveSel} onChange={(e) => { if (e.target.value) cmd('fontSize', e.target.value); e.target.value = '' }} title="Taille">
          <option value="">Taille</option>
          {[['1', 'Très petit'], ['2', 'Petit'], ['3', 'Normal'], ['4', 'Grand'], ['5', 'Très grand'], ['6', 'Titre']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label className="he-color" title="Couleur du texte : sélectionnez d’abord le texte" onPointerDown={beginColor}><span style={{ background: 'currentColor' }} /><input type="color" defaultValue="#1d1d1f" onFocus={beginColor} onInput={(e) => applyColor((e.target as HTMLInputElement).value)} onChange={(e) => applyColor(e.target.value)} /></label>
        <span className="sep" />
        <button onClick={() => cmd('bold')} title="Gras (⌘B)"><Bold size={14} /></button>
        <button onClick={() => cmd('italic')} title="Italique (⌘I)"><Italic size={14} /></button>
        <button onClick={() => cmd('underline')} title="Souligné"><Underline size={14} /></button>
        <span className="sep" />
        <button onClick={() => cmd('justifyLeft')} title="Aligner à gauche"><AlignLeft size={14} /></button>
        <button onClick={() => cmd('justifyCenter')} title="Centrer"><AlignCenter size={14} /></button>
        <button onClick={() => cmd('justifyRight')} title="Aligner à droite"><AlignRight size={14} /></button>
        <span className="sep" />
        <button onClick={() => cmd('insertUnorderedList')} title="Liste à puces"><List size={14} /></button>
        <button onClick={() => cmd('insertOrderedList')} title="Liste numérotée"><ListOrdered size={14} /></button>
        <button onClick={() => cmd('insertHorizontalRule')} title="Séparateur"><Minus size={14} /></button>
        <button onClick={() => cmd('insertHTML', '<table cellpadding="6" cellspacing="0" border="0" style="border-collapse:collapse"><tr><td style="vertical-align:top;padding-right:12px">Colonne 1</td><td style="vertical-align:top">Colonne 2</td></tr></table><p></p>')} title="Tableau 2 colonnes (photo à gauche, texte à droite)"><Table2 size={14} /></button>
        <span className="sep" />
        <button onClick={link} title="Lien"><Link2 size={14} /></button>
        <button onClick={() => void replaceImage()} title="Remplacer l’image sélectionnée (ou insérer)"><ImageIcon size={14} /></button>
        <span className="sep" />
        <button onClick={() => cmd('removeFormat')} title="Effacer la mise en forme"><Eraser size={14} /></button>
        <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{ready ? '⌘+clic ouvre un lien' : 'Chargement…'}</span>
      </div>
      <iframe ref={ref} title="signature" sandbox="allow-same-origin allow-scripts allow-popups" />
    </div>
  )
}