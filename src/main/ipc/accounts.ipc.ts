// src/main/ipc/accounts.ipc.ts
import { log } from '../utils/logger'
import { handle } from './index'
import { AccountRepo } from '../db/repositories/AccountRepo'
import { Credentials } from '../auth/Credentials'
import { SyncManager } from '../sync/SyncManager'
import { googleLogin, googleDataLogin } from '../auth/oauth/google'
import { hasGoogleData } from '../auth'
import { microsoftLogin } from '../auth/oauth/microsoft'
import { ImapSyncEngine } from '../sync/ImapSyncEngine'
import { verifySmtp } from '../smtp/Sender'
import type { Account } from '@shared/models/Account'

export function registerAccountsIpc(): void {
  handle('accounts:list', () => AccountRepo.list())
  handle('accounts:add', (input) => {
    const acc = AccountRepo.create(input)
    Credentials.setAccount(acc.id, input.credentials)
    SyncManager.attach(acc)
    return acc
  })
  handle('accounts:update', (id, patch) => AccountRepo.update(id, patch))
  handle('accounts:reorder', (ids) => AccountRepo.reorder(ids))
  handle('accounts:remove', async (id) => { await SyncManager.detach(id); AccountRepo.remove(id); Credentials.remove(`account:${id}`) })
  handle('accounts:oauth', async (provider) => {
    const t = provider === 'google' ? await googleLogin() : await microsoftLogin()
    return { email: t.email, name: t.name, accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: t.expiresAt }
  })
  // Google Agenda + Contacts pour un compte Gmail ajouté en IMAP (mot de passe d'application)
  handle('accounts:googleData', async (accountId, action) => {
    const a = AccountRepo.get(accountId); if (!a) throw new Error('compte introuvable')
    const key = `google-data:${accountId}`
    if (action === 'disconnect') { Credentials.remove(key); return { connected: false } }
    if (action === 'connect') {
      const t = await googleDataLogin()
      if (t.email.toLowerCase() !== a.email.toLowerCase()) throw new Error(`Vous avez autorisé ${t.email}, mais ce compte est ${a.email}. Recommencez en choisissant le bon compte Google.`)
      Credentials.set(key, JSON.stringify({ accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: t.expiresAt }))
      return { connected: true, email: t.email }
    }
    return { connected: hasGoogleData(a), email: a.email }
  })
  handle('accounts:test', async (input) => {
    const tmp: Account = { id: `tmp-${Date.now()}`, email: input.email, name: input.name, provider: input.provider, auth: input.auth, imap: input.imap, smtp: input.smtp, color: '', defaultSignatureId: null, aiInstructions: '', purgeSpamDays: null, purgeTrashDays: null, createdAt: 0 }
    try {
      Credentials.setAccount(tmp.id, input.credentials)
      log.info('accounts', `test ${input.email} (${input.auth}) sur ${input.imap.host}:${input.imap.port}`)
      const e = new ImapSyncEngine(tmp)
      await e.connect(); await e.disconnect()
      await verifySmtp(tmp)
      return { ok: true }
    } catch (e: any) {
      // ImapFlow renvoie « Command failed » : le texte utile est dans responseText / serverResponseCode
      const detail = [e?.responseText, e?.serverResponseCode].filter(Boolean).join(' ')
      let msg = e?.message ?? String(e)
      if (e?.authenticationFailed || /AUTHENTICATIONFAILED|Invalid credentials|Command failed/i.test(`${msg} ${detail}`)) {
        msg = /gmail\.com$/i.test(input.imap.host)
          ? `Identifiants refusés par Gmail${detail ? ` (${detail})` : ''}. Vérifiez que la validation en deux étapes est activée sur ce compte Google et que vous avez collé un mot de passe d’application généré pour ce compte précis — pas votre mot de passe habituel.`
          : `Identifiants refusés par le serveur${detail ? ` (${detail})` : ''}.`
      } else if (/authenticated but not connected/i.test(`${msg} ${detail}`)) {
        msg = `Connexion Microsoft réussie, mais ce compte n’a pas de boîte aux lettres accessible en IMAP. Soit il n’a pas de boîte Outlook/Exchange (compte Microsoft créé avec une adresse d’un autre fournisseur), soit l’administrateur a désactivé IMAP sur cette boîte. Utilisez une adresse @outlook.com, @hotmail.com ou un compte Microsoft 365 avec IMAP activé.`
      } else if (/Web login required|browser/i.test(detail)) {
        msg = 'Google a bloqué la connexion : ouvrez https://accounts.google.com/DisplayUnlockCaptcha avec ce compte, puis réessayez.'
      } else if (detail) msg = `${msg} (${detail})`
      log.warn('accounts', 'test', input.email, msg)
      return { ok: false, error: msg }
    }
    finally { try { Credentials.remove(`account:${tmp.id}`) } catch {} }
  })
}