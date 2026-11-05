// src/renderer/src/design-system/AppPasswordInput.tsx
// Saisie d'un mot de passe d'application à 16 caractères (Google « xxxx xxxx xxxx xxxx », iCloud « xxxx-xxxx-xxxx-xxxx ») :
// une case par caractère, collage de la chaîne entière, œil pour afficher/masquer.
import { useRef, useState } from 'react'
import { Eye, EyeOff, ClipboardPaste } from 'lucide-react'

const LEN = 16
const clean = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, LEN)

export function AppPasswordInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const [show, setShow] = useState(false)
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const chars = clean(value)
  const focus = (i: number) => refs.current[Math.max(0, Math.min(LEN - 1, i))]?.focus()
  const setAt = (i: number, ch: string) => { const arr = chars.padEnd(LEN, ' ').split(''); arr[i] = ch || ' '; onChange(arr.join('').replace(/\s+$/, '').replace(/ /g, '')) }
  const paste = async (text?: string) => { const t = clean(text ?? (await navigator.clipboard.readText().catch(() => ''))); if (!t) return; onChange(t); focus(Math.min(t.length, LEN - 1)) }
  return (
    <div className="apw">
      <div className="apw-groups">
        {[0, 1, 2, 3].map((g) => (
          <div key={g} className="apw-group">
            {[0, 1, 2, 3].map((k) => { const i = g * 4 + k; return (
              <input key={i} ref={(el) => { refs.current[i] = el }} className="apw-cell" type={show ? 'text' : 'password'} inputMode="text" autoComplete="off" spellCheck={false} maxLength={1} autoFocus={autoFocus && i === 0}
                value={chars[i] ?? ''}
                onFocus={(e) => e.target.select()}
                onPaste={(e) => { e.preventDefault(); void paste(e.clipboardData.getData('text')) }}
                onChange={(e) => { const v = clean(e.target.value); if (v.length > 1) { void paste(v); return } setAt(i, v); if (v) focus(i + 1) }}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace') { if (chars[i]) { setAt(i, ''); e.preventDefault() } else { focus(i - 1); setAt(i - 1, ''); e.preventDefault() } }
                  else if (e.key === 'ArrowLeft') { focus(i - 1); e.preventDefault() }
                  else if (e.key === 'ArrowRight') { focus(i + 1); e.preventDefault() }
                }} />
            ) })}
          </div>
        ))}
      </div>
      <div className="apw-tools">
        <button type="button" className="icon-btn" title="Coller depuis le presse-papiers" onClick={() => void paste()}><ClipboardPaste size={15} /></button>
        <button type="button" className="icon-btn" title={show ? 'Masquer' : 'Afficher'} onClick={() => setShow(!show)}>{show ? <EyeOff size={15} /> : <Eye size={15} />}</button>
      </div>
      <div className="apw-count">{chars.length}/{LEN}</div>
    </div>
  )
}