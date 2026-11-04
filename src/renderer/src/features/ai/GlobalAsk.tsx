// src/renderer/src/features/ai/GlobalAsk.tsx
import { useState } from 'react'
import { Sparkles, ArrowUp } from 'lucide-react'
import { useAi } from '@/stores/ai.store'
import { useAccounts } from '@/stores/accounts.store'

export function GlobalAsk() {
  const settings = useAi((s) => s.settings)
  const streaming = useAi((s) => s.streaming)
  const run = useAi((s) => s.run)
  const accounts = useAccounts((s) => s.accounts)
  const [q, setQ] = useState('')
  if (!settings?.enabled || !settings.mailSearch || !settings.mailSearchAccountIds.length) return null
  const ask = () => {
    const p = q.trim(); if (!p || streaming) return
    const allowed = accounts.filter((a) => settings.mailSearchAccountIds.includes(a.id))
    void run({ task: 'chat', accountId: (allowed[0] ?? accounts[0]).id, userPrompt: p, global: true })
    setQ('')
  }
  return (
    <div className="global-ask">
      <Sparkles size={15} style={{ color: 'var(--accent)' }} />
      <input value={q} placeholder="Poser une question sur vos messages…" onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} />
      <button className="btn primary" disabled={!q.trim() || streaming} onClick={ask} aria-label="Demander"><ArrowUp size={14} /></button>
    </div>
  )
}