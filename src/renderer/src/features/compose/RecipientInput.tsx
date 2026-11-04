// src/renderer/src/features/compose/RecipientInput.tsx
import { useEffect, useRef, useState } from 'react'
import { invoke } from '@/lib/api'
import { X, Copy } from 'lucide-react'
import type { Address } from '@shared/models/Message'
import { parseAddresses, isEmail } from '@/lib/text'
import { useUi } from '@/stores/ui.store'

const format = (a: Address): string => (a.name ? `${a.name} <${a.address}>` : a.address)

export function RecipientInput({ label, value, onChange, autoFocus }: { label: string; value: Address[]; onChange: (v: Address[]) => void; autoFocus?: boolean }) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [sugg, setSugg] = useState<Address[]>([])
  const [hi, setHi] = useState(0)
  useEffect(() => {
    const q = text.trim()
    if (q.length < 2 || /[,;]/.test(q)) { setSugg([]); return }
    const t = setTimeout(() => void invoke('contacts:suggest', q).then((r) => { setSugg(r.filter((x) => !value.some((v) => v.address.toLowerCase() === x.address.toLowerCase()))); setHi(0) }), 100)
    return () => clearTimeout(t)
  }, [text, value])
  const pick = (a: Address) => { onChange([...value, a]); setText(''); setSugg([]); requestAnimationFrame(() => inputRef.current?.focus()) }

  const commit = (raw = text) => {
    const parsed = parseAddresses(raw).filter((a) => isEmail(a.address))
    if (parsed.length) onChange([...value, ...parsed])
    setText('')
  }
  const edit = (i: number) => {
    if (text.trim()) commit()
    const a = value[i]
    onChange(value.filter((_, j) => j !== i))
    setText(format(a))
    requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select() })
  }
  const copy = async (a: Address) => { await navigator.clipboard.writeText(format(a)); useUi.getState().toast({ text: 'Adresse copiée', ttl: 1500 }) }

  return (
    <div className="compose-row" style={{ position: 'relative' }} onClick={() => inputRef.current?.focus()}>
      <span className="k">{label}</span>
      <div className="chips">
        {value.map((a, i) => (
          <span key={`${a.address}-${i}`} className="chip sel" title="Cliquer pour modifier">
            <span className="chip-text" onClick={(e) => { e.stopPropagation(); edit(i) }}>{format(a)}</span>
            <button aria-label="Copier" onClick={(e) => { e.stopPropagation(); void copy(a) }}><Copy size={10} /></button>
            <button aria-label="Retirer" onClick={(e) => { e.stopPropagation(); onChange(value.filter((_, j) => j !== i)) }}><X size={11} /></button>
          </span>
        ))}
        <input ref={inputRef} autoFocus={autoFocus} value={text} onChange={(e) => setText(e.target.value)}
          onPaste={(e) => { const t = e.clipboardData.getData('text'); if (/[,;]|<.*>/.test(t) || isEmail(t.trim())) { e.preventDefault(); commit(text + t) } }}
          onKeyDown={(e) => {
            if (sugg.length) {
              if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => (h + 1) % sugg.length); return }
              if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => (h - 1 + sugg.length) % sugg.length); return }
              if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(sugg[hi]); return }
              if (e.key === 'Escape') { setSugg([]); return }
            }
            if (['Enter', ',', ';', 'Tab'].includes(e.key) && text.trim()) { e.preventDefault(); commit() }
            if (e.key === 'Backspace' && !text && value.length) edit(value.length - 1)
          }}
          onBlur={() => setTimeout(() => { if (!document.activeElement?.closest('.sugg')) { setSugg([]); commit() } }, 120)} />
      </div>
      {sugg.length > 0 && (
        <div className="sugg" onMouseDown={(e) => e.preventDefault()}>
          {sugg.map((a, i) => <button key={a.address} className={i === hi ? 'on' : ''} onMouseEnter={() => setHi(i)} onClick={() => pick(a)}><span className="s-name">{a.name || a.address}</span>{a.name && <span className="s-addr">{a.address}</span>}</button>)}
        </div>
      )}
    </div>
  )
}