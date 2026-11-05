// src/renderer/src/features/accounts/ImapForm.tsx
import { useState } from 'react'
import { AppPasswordInput } from '@/design-system/AppPasswordInput'
import type { AccountInput, ProviderPreset, ServerConfig } from '@shared/models/Account'
import { Input } from '@/design-system/Field'

const PRESETS: Record<string, { imap: ServerConfig; smtp: ServerConfig }> = {
  gmail: { imap: { host: 'imap.gmail.com', port: 993, secure: true }, smtp: { host: 'smtp.gmail.com', port: 465, secure: true } },
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
      {provider === 'gmail' && (
        <div className="app-pass-guide">
          <div className="app-pass-title">Mot de passe d’application Google</div>
          <ol>
            <li>Activez la <b>validation en deux étapes</b> sur votre compte Google (si ce n’est pas déjà fait).</li>
            <li>Ouvrez <a href="https://myaccount.google.com/apppasswords" onClick={(e) => { e.preventDefault(); window.open('https://myaccount.google.com/apppasswords') }}>myaccount.google.com/apppasswords</a>, nommez-le « AIMAIL » et cliquez <b>Créer</b>.</li>
            <li>Copiez les 16 caractères affichés dans le champ ci-dessous (les espaces n’ont pas d’importance).</li>
          </ol>
          <div className="app-pass-note">Votre mot de passe Google habituel ne fonctionne pas en IMAP ; le mot de passe d’application se révoque à tout moment depuis la même page.</div>
        </div>
      )}
      {provider === 'gmail' || provider === 'icloud'
        ? <AppPasswordInput value={password} onChange={setPassword} />
        : <Input placeholder="Mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />}
      {provider === 'custom' && <>
        <div className="two"><Input placeholder="Serveur IMAP" value={imap.host} onChange={(e) => setImap({ ...imap, host: e.target.value })} /><Input type="number" value={imap.port} onChange={(e) => setImap({ ...imap, port: +e.target.value, secure: +e.target.value === 993 })} /></div>
        <div className="two"><Input placeholder="Serveur SMTP" value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} /><Input type="number" value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: +e.target.value, secure: +e.target.value === 465 })} /></div>
      </>}
      {error && <span className="err">{error}</span>}
      <button className="btn primary" style={{ alignSelf: 'flex-start', marginTop: 6 }} disabled={busy || !email || !password || !imap.host} onClick={submit}>{busy ? 'Vérification…' : 'Ajouter le compte'}</button>
    </div>
  )
}