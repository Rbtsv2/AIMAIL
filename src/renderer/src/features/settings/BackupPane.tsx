// src/renderer/src/features/settings/BackupPane.tsx
import { useEffect, useState } from 'react'
import { Download, Upload, FolderOpen, Check, Mail } from 'lucide-react'
import type { AccountInput, ProviderPreset } from '@shared/models/Account'
import { invoke } from '@/lib/api'
import { useUi } from '@/stores/ui.store'
import { useAccounts } from '@/stores/accounts.store'
import { useSettings } from '@/stores/settings.store'
import { Group, Row, Input } from '@/design-system/Field'
import { cleanSignatureHtml, signatureText } from '@shared/signature'

type TbAccount = Awaited<ReturnType<typeof invoke<'thunderbird:read'>>>['accounts'][number]
const PRESET: Record<string, { imap: AccountInput['imap']; smtp: AccountInput['smtp'] }> = {
  gmail: { imap: { host: 'imap.gmail.com', port: 993, secure: true }, smtp: { host: 'smtp.gmail.com', port: 465, secure: true } },
  outlook: { imap: { host: 'outlook.office365.com', port: 993, secure: true }, smtp: { host: 'smtp.office365.com', port: 587, secure: false } },
  icloud: { imap: { host: 'imap.mail.me.com', port: 993, secure: true }, smtp: { host: 'smtp.mail.me.com', port: 587, secure: false } },
  ovh: { imap: { host: 'ssl0.ovh.net', port: 993, secure: true }, smtp: { host: 'ssl0.ovh.net', port: 465, secure: true } }
}
const guess = (email: string): ProviderPreset => { const d = email.split('@')[1]?.toLowerCase() ?? ''; return /gmail|googlemail/.test(d) ? 'gmail' : /outlook|hotmail|live\.|msn/.test(d) ? 'outlook' : /icloud|me\.com|mac\.com/.test(d) ? 'icloud' : 'custom' }

export function BackupPane() {
  const toast = useUi((s) => s.toast)
  const accounts = useAccounts((s) => s.accounts)
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [profiles, setProfiles] = useState<string[]>([])
  const [tb, setTb] = useState<{ path: string; accounts: TbAccount[]; addressBooks: string[] } | null>(null)
  const [pw, setPw] = useState<Record<string, string>>({})
  const [outlookEmail, setOutlookEmail] = useState('')
  const [outlookPw, setOutlookPw] = useState('')
  useEffect(() => { void invoke('thunderbird:profiles').then(setProfiles) }, [])

  const err = (e: any) => toast({ text: String(e?.message ?? e).replace(/^Error invoking remote method '[^']+': Error: /, ''), ttl: 8000 })
  const doExport = async () => { if (pass.length < 6) { toast({ text: 'Phrase secrète : 6 caractères minimum', ttl: 4000 }); return } setBusy(true); try { const p = await invoke('backup:export', pass); if (p) toast({ text: `Sauvegarde écrite : ${p}`, ttl: 6000 }) } catch (e) { err(e) } finally { setBusy(false) } }
  const doImport = async () => { if (!pass) { toast({ text: 'Indiquez la phrase secrète du fichier', ttl: 4000 }); return } setBusy(true); try { const r = await invoke('backup:import', pass); toast({ text: `Importé : ${r.accounts} comptes, ${r.signatures} signatures, ${r.sources} sources, ${r.contacts} contacts, ${r.events} événements`, ttl: 8000 }); await useAccounts.getState().load(); await useSettings.getState().load() } catch (e) { err(e) } finally { setBusy(false) } }
  const readTb = async (path: string) => { try { setTb(await invoke('thunderbird:read', path)) } catch (e) { err(e) } }
  const pickTb = async () => { const p = await invoke('thunderbird:pick'); if (p) await readTb(p) }
  const addTb = async (a: TbAccount) => {
    setBusy(true)
    try {
      const provider = (a.provider as ProviderPreset) || 'custom'
      let input: AccountInput
      if (a.oauth) {
        const t = await invoke('accounts:oauth', a.oauth)
        input = { email: t.email || a.email, name: a.name || t.name, provider, auth: a.oauth === 'google' ? 'oauth-google' : 'oauth-microsoft', imap: a.imap, smtp: a.smtp, credentials: { accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: t.expiresAt } }
      } else {
        const password = pw[a.email] ?? ''
        if (!password) { toast({ text: `Mot de passe requis pour ${a.email}`, ttl: 4000 }); return }
        input = { email: a.email, name: a.name || a.email, provider, auth: 'password', imap: a.imap, smtp: a.smtp, credentials: { password } }
      }
      const t = await invoke('accounts:test', input)
      if (!t.ok) { toast({ text: `${a.email} : ${t.error}`, ttl: 8000 }); return }
      const created = await useAccounts.getState().add(input)
      if (a.signatureHtml) { const html = cleanSignatureHtml(a.signatureHtml); const sig = await invoke('signatures:save', { id: '', name: `Signature ${a.email}`, html, text: signatureText(html), accountId: created.id }); await useAccounts.getState().update(created.id, { defaultSignatureId: sig.id }); await useSettings.getState().load() }
      void invoke('sync:now', created.id)
      toast({ text: `${a.email} ajouté` })
    } catch (e) { err(e) } finally { setBusy(false) }
  }
  const addOutlook = async () => {
    const email = outlookEmail.trim(); if (!email) return
    const provider = guess(email)
    setBusy(true)
    try {
      if (provider === 'gmail' || provider === 'outlook') {
        const t = await invoke('accounts:oauth', provider === 'gmail' ? 'google' : 'microsoft')
        const input: AccountInput = { email: t.email || email, name: t.name || email, provider, auth: provider === 'gmail' ? 'oauth-google' : 'oauth-microsoft', imap: PRESET[provider].imap, smtp: PRESET[provider].smtp, credentials: { accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: t.expiresAt } }
        const r = await invoke('accounts:test', input); if (!r.ok) { toast({ text: r.error ?? 'échec', ttl: 8000 }); return }
        await useAccounts.getState().add(input); toast({ text: `${input.email} ajouté` })
      } else {
        const preset = PRESET[provider] ?? { imap: { host: `imap.${email.split('@')[1]}`, port: 993, secure: true }, smtp: { host: `smtp.${email.split('@')[1]}`, port: 587, secure: false } }
        const input: AccountInput = { email, name: email, provider, auth: 'password', imap: preset.imap, smtp: preset.smtp, credentials: { password: outlookPw } }
        const r = await invoke('accounts:test', input); if (!r.ok) { toast({ text: `${r.error} — pour un serveur inconnu, passez par Ajouter un compte › Autre (IMAP).`, ttl: 9000 }); return }
        await useAccounts.getState().add(input); toast({ text: `${email} ajouté` })
      }
      setOutlookEmail(''); setOutlookPw('')
    } catch (e) { err(e) } finally { setBusy(false) }
  }
  const has = (email: string) => accounts.some((a) => a.email.toLowerCase() === email.toLowerCase())

  return (
    <>
      <h2>Sauvegarde & import</h2>
      <Group>
        <Row label="Phrase secrète" hint="Chiffre la sauvegarde (AES-256). Comptes, mots de passe, clés API, signatures, sources, contacts et agendas y sont inclus."><Input type="password" value={pass} placeholder="6 caractères minimum" onChange={(e) => setPass(e.target.value)} /></Row>
        <Row label="Exporter toute la configuration" hint="Fichier .mailbackup à conserver ou à transférer sur une autre machine."><button className="btn primary" disabled={busy} onClick={() => void doExport()}><Download size={14} /> Exporter</button></Row>
        <Row label="Importer une sauvegarde" hint="Les comptes déjà présents sont conservés ; le reste est fusionné."><button className="btn quiet" disabled={busy} onClick={() => void doImport()}><Upload size={14} /> Importer</button></Row>
      </Group>

      <h2 style={{ marginTop: 28 }}>Depuis Thunderbird</h2>
      <Group>
        <div className="frow col">
          <div className="lab">Profil Thunderbird<small>{profiles.length ? `${profiles.length} profil${profiles.length > 1 ? 's' : ''} détecté${profiles.length > 1 ? 's' : ''} sur cet ordinateur. Choisissez celui à lire.` : 'Aucun profil détecté : choisissez le dossier qui contient prefs.js.'}</small></div>
          <div className="profile-list">
            {profiles.map((p) => (
              <button key={p} className={`profile-item ${tb?.path === p ? 'on' : ''}`} onClick={() => void readTb(p)}>
                <span className="pi-name">{p.split(/[\\/]/).pop()}</span>
                <span className="pi-path">{p}</span>
              </button>
            ))}
            <button className="profile-item pick" onClick={() => void pickTb()}><FolderOpen size={15} /><span className="pi-name">Autre dossier…</span></button>
          </div>
        </div>
        {tb && tb.accounts.length === 0 && <div className="frow" style={{ color: 'var(--text-2)' }}>Aucun compte IMAP dans ce profil.</div>}
        {tb?.accounts.map((a) => (
          <Row key={a.email} label={a.email} hint={`${a.name || '—'} · ${a.imap.host} · ${a.oauth ? 'connexion ' + (a.oauth === 'google' ? 'Google' : 'Microsoft') : 'mot de passe'}${a.signatureHtml ? ' · signature' : ''}`}>
            {has(a.email) ? <span style={{ color: '#2eaf8a', fontSize: 'var(--fs-sm)', display: 'flex', alignItems: 'center', gap: 4 }}><Check size={14} /> déjà ajouté</span> : <>
              {!a.oauth && <Input type="password" placeholder="Mot de passe" value={pw[a.email] ?? ''} onChange={(e) => setPw({ ...pw, [a.email]: e.target.value })} style={{ minWidth: 160 }} />}
              <button className="btn primary" disabled={busy} onClick={() => void addTb(a)}>Ajouter</button>
            </>}
          </Row>
        ))}
        {tb && tb.addressBooks.length > 0 && <Row label="Carnets d’adresses" hint={tb.addressBooks.map((p) => p.split(/[\\/]/).pop()).join(', ')}><button className="btn quiet" disabled={busy} onClick={async () => { const r = await invoke('thunderbird:importBooks', tb.addressBooks); toast({ text: `${r.imported} contacts ajoutés, ${r.updated} mis à jour`, ttl: 5000 }) }}>Importer les contacts</button></Row>}
      </Group>

      <h2 style={{ marginTop: 28 }}>Depuis Outlook</h2>
      <Group>
        <div className="frow" style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)' }}>Outlook ne possède pas de fichier de configuration exportable (les paramètres sont dans le registre Windows). Indiquez l’adresse : le fournisseur est reconnu automatiquement et la connexion se fait par Google, Microsoft ou mot de passe. Pour les contacts, exportez-les depuis Outlook en CSV puis importez-les dans la page Contacts.</div>
        <Row label="Adresse e-mail"><Input type="email" value={outlookEmail} placeholder="vous@exemple.fr" onChange={(e) => setOutlookEmail(e.target.value)} />
          {!['gmail', 'outlook'].includes(guess(outlookEmail)) && outlookEmail.includes('@') && <Input type="password" placeholder="Mot de passe" value={outlookPw} onChange={(e) => setOutlookPw(e.target.value)} />}
          <button className="btn primary" disabled={busy || !outlookEmail.includes('@')} onClick={() => void addOutlook()}><Mail size={14} /> Ajouter</button>
        </Row>
      </Group>
    </>
  )
}