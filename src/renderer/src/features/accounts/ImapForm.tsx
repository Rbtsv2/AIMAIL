import { useState } from 'react'
import type { AccountInput, ProviderPreset, ServerConfig } from '@shared/models/Account'
import { Input } from '@/design-system/Field'

const PRESETS: Record<string, { imap: ServerConfig; smtp: ServerConfig }> = {
  icloud: { imap: { host: 'imap.mail.me.com', port: 993, secure: true }, smtp: { host: 'smtp.mail.me.com', port: 587, secure: false } },
  ovh: { imap: { host: 'ssl0.ovh.net', port: 993, secure: true }, smtp: { host: 'ssl0.ovh.net', port: 465, secure: true } },
  custom: { imap: { host: '', port: 993, secure: true }, smtp: { host: '', port: 465, secure: true } }
}

export function ImapForm({ provider, onSubmit, busy, error }: { provider: ProviderPreset; onSubmit: (i: AccountInput) => void; busy: boolean; error?: string }) {
  const preset = PRESETS[provider] ?? PRESETS.custom
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [imap, setImap] = useState(preset.imap)
  const [smtp, setSmtp] = useState(preset.smtp)
  const submit = () => onSubmit({ email, name: name || email, provider, auth: 'password', imap, smtp, credentials: { password } })
  return (
    <div className="form">
      <Input placeholder="Votre nom" value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="Adresse e-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input placeholder={provider === 'icloud' ? 'Mot de passe d’application' : 'Mot de passe'} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {provider === 'custom' && <>
        <div className="two"><Input placeholder="Serveur IMAP" value={imap.host} onChange={(e) => setImap({ ...imap, host: e.target.value })} /><Input type="number" value={imap.port} onChange={(e) => setImap({ ...imap, port: +e.target.value, secure: +e.target.value === 993 })} /></div>
        <div className="two"><Input placeholder="Serveur SMTP" value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} /><Input type="number" value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: +e.target.value, secure: +e.target.value === 465 })} /></div>
      </>}
      {error && <span className="err">{error}</span>}
      <button className="btn primary" style={{ alignSelf: 'flex-start', marginTop: 6 }} disabled={busy || !email || !password || !imap.host} onClick={submit}>{busy ? 'Vérification…' : 'Ajouter le compte'}</button>
    </div>
  )
}
