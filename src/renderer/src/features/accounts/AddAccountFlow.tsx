// src/renderer/src/features/accounts/AddAccountFlow.tsx
import { useState } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import { IconButton } from '@/design-system/IconButton'
import type { AccountInput, ProviderPreset } from '@shared/models/Account'
import { ProviderPicker } from './ProviderPicker'
import { ImapForm } from './ImapForm'
import { invoke } from '@/lib/api'
import { useAccounts } from '@/stores/accounts.store'
import { useUi } from '@/stores/ui.store'
import { useMail } from '@/stores/mail.store'
import logo from '@/assets/icons/logo.png'

const OAUTH: Record<string, { provider: 'google' | 'microsoft'; imap: AccountInput['imap']; smtp: AccountInput['smtp']; auth: AccountInput['auth'] }> = {
  gmail: { provider: 'google', imap: { host: 'imap.gmail.com', port: 993, secure: true }, smtp: { host: 'smtp.gmail.com', port: 465, secure: true }, auth: 'oauth-google' },
  outlook: { provider: 'microsoft', imap: { host: 'outlook.office365.com', port: 993, secure: true }, smtp: { host: 'smtp.office365.com', port: 587, secure: false }, auth: 'oauth-microsoft' }
}

export function AddAccountFlow({ onDone }: { onDone?: () => void }) {
  const [provider, setProvider] = useState<ProviderPreset | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const add = useAccounts((s) => s.add)

  const finish = async (input: AccountInput) => {
    setBusy(true); setError(undefined)
    const t = await invoke('accounts:test', input)
    if (!t.ok) { setBusy(false); setError(t.error); return }
    const a = await add(input)
    await invoke('sync:now', a.id).catch(() => {})
    setBusy(false)
    useUi.getState().toast({ text: `${a.email} ajouté` })
    useMail.getState().setView({ accountId: a.id, role: 'inbox', label: 'Réception' })
    onDone?.()
  }

  const pick = async (p: ProviderPreset) => {
    setProvider(p); setError(undefined)
    const o = OAUTH[p]
    if (!o) return
    setBusy(true)
    try {
      const t = await invoke('accounts:oauth', o.provider)
      await finish({ email: t.email, name: t.name, provider: p, auth: o.auth, imap: o.imap, smtp: o.smtp, credentials: { accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: t.expiresAt } })
    } catch (e: any) { setError(e?.message ?? String(e)) } finally { setBusy(false) }
  }

  if (!provider) return <ProviderPicker onPick={(p) => void pick(p)} />
  if (OAUTH[provider]) return (
    <div className="form">
      <p style={{ color: 'var(--text-2)', margin: 0 }}>{busy ? 'Terminez la connexion dans votre navigateur…' : error ? '' : 'Connexion…'}</p>
      {error && <span className="err">{error}</span>}
      <button className="btn quiet" style={{ alignSelf: 'flex-start' }} onClick={() => setProvider(null)}><ArrowLeft size={14} /> Retour</button>
    </div>
  )
  return (
    <div>
      <button className="btn quiet" style={{ marginBottom: 12, marginLeft: -12 }} onClick={() => setProvider(null)}><ArrowLeft size={14} /> Retour</button>
      <ImapForm provider={provider} onSubmit={(i) => void finish(i)} busy={busy} error={error} />
    </div>
  )
}

export function Onboarding() {
  return (
    <div className="onboard">
      <div className="onboard-bar drag" />
      <div className="onboard-card">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}><img src={logo} alt="" width={40} height={40} style={{ borderRadius: 9 }} />AIMAIL</h1>
        <p>Ajoutez une première boîte pour commencer. Vos identifiants restent sur cet ordinateur.</p>
        <AddAccountFlow />
      </div>
    </div>
  )
}

export function AddAccountPage() {
  const close = () => useUi.getState().setAddAccount(false)
  return (
    <section className="settings-page">
      <div className="pane-head drag" style={{ justifyContent: 'flex-start', paddingLeft: 20 }}>
        <span style={{ fontWeight: 600, fontSize: 'var(--fs-lg)' }}>Ajouter un compte</span>
        <div style={{ flex: 1 }} />
        <IconButton label="Fermer" onClick={close}><X size={16} /></IconButton>
      </div>
      <div className="settings-pane" style={{ maxWidth: 560 }}><AddAccountFlow onDone={close} /></div>
    </section>
  )
}