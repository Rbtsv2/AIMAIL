// src/renderer/src/design-system/CommandPalette.tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, PenLine, Settings, RefreshCw, Inbox, Star, Send, Archive, Trash2, Sparkles, Users, CalendarDays, type LucideIcon } from 'lucide-react'
import { useUi } from '@/stores/ui.store'
import { useMail } from '@/stores/mail.store'
import { useCompose } from '@/stores/compose.store'
import { useAccounts } from '@/stores/accounts.store'
import { invoke } from '@/lib/api'
import { fade, pop } from './motion'

interface Cmd { id: string; label: string; icon: LucideIcon; hint?: string; run: () => void }

export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen)
  const close = () => useUi.getState().setPalette(false)
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const accounts = useAccounts((s) => s.accounts)

  const cmds = useMemo<Cmd[]>(() => {
    const m = useMail.getState()
    const base: Cmd[] = [
      { id: 'compose', label: 'Nouveau message', icon: PenLine, hint: '⌘N', run: () => useCompose.getState().openNew() },
      { id: 'inbox', label: 'Réception', icon: Inbox, run: () => m.setView({ role: 'inbox', label: 'Réception' }) },
      { id: 'starred', label: 'Suivis', icon: Star, run: () => m.setView({ role: 'starred', label: 'Suivis' }) },
      { id: 'sent', label: 'Envoyés', icon: Send, run: () => m.setView({ role: 'sent', label: 'Envoyés' }) },
      { id: 'archive', label: 'Archive', icon: Archive, run: () => m.setView({ role: 'archive', label: 'Archive' }) },
      { id: 'trash', label: 'Corbeille', icon: Trash2, run: () => m.setView({ role: 'trash', label: 'Corbeille' }) },
      { id: 'sync', label: 'Synchroniser maintenant', icon: RefreshCw, hint: '⇧R', run: () => void invoke('sync:now') },
      { id: 'calendar', label: 'Agenda', icon: CalendarDays, run: () => useUi.getState().setCalendar(true) },
      { id: 'contacts', label: 'Contacts', icon: Users, run: () => useUi.getState().setContacts(true) },
      { id: 'ai', label: 'Réglages de l’IA', icon: Sparkles, run: () => useUi.getState().openSettings('ai') },
      { id: 'settings', label: 'Réglages', icon: Settings, hint: '⌘,', run: () => useUi.getState().openSettings() }
    ]
    for (const a of accounts) base.push({ id: `acc-${a.id}`, label: `Réception · ${a.email}`, icon: Inbox, run: () => m.setView({ accountId: a.id, role: 'inbox', label: a.email }) })
    return base
  }, [accounts])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? cmds.filter((c) => c.label.toLowerCase().includes(s)) : cmds
  }, [q, cmds])

  useEffect(() => { if (open) { setQ(''); setI(0); setTimeout(() => inputRef.current?.focus(), 10) } }, [open])
  useEffect(() => setI(0), [q])

  const runSearch = () => { useMail.getState().setSearch(q.trim()); close() }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(x + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(x - 1, 0)) }
    if (e.key === 'Enter') { e.preventDefault(); if (filtered[i]) { filtered[i].run(); close() } else runSearch() }
    if (e.key === 'Escape') close()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="palette-backdrop" {...fade} onMouseDown={close}>
          <motion.div className="palette" {...pop} onMouseDown={(e) => e.stopPropagation()}>
            <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Chercher un message ou une action" />
            <ul>
              {filtered.map((c, idx) => (
                <li key={c.id} className={idx === i ? 'on' : ''} onMouseEnter={() => setI(idx)} onClick={() => { c.run(); close() }}>
                  <c.icon size={15} /> {c.label}{c.hint && <span className="hint"><kbd>{c.hint}</kbd></span>}
                </li>
              ))}
              {q.trim() && <li className={filtered.length === 0 ? 'on' : ''} onClick={runSearch}><Search size={15} /> Chercher « {q.trim()} » dans les messages</li>}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}