// src/main/ipc/accounts.ipc.ts
import { log } from '../utils/logger'
import { handle } from './index'
import { AccountRepo } from '../db/repositories/AccountRepo'
import { Credentials } from '../auth/Credentials'
import { SyncManager } from '../sync/SyncManager'
import { googleLogin } from '../auth/oauth/google'
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
  handle('accounts:test', async (input) => {
    const tmp: Account = { id: `tmp-${Date.now()}`, email: input.email, name: input.name, provider: input.provider, auth: input.auth, imap: input.imap, smtp: input.smtp, color: '', defaultSignatureId: null, aiInstructions: '', purgeSpamDays: null, purgeTrashDays: null, createdAt: 0 }
    try {
      Credentials.setAccount(tmp.id, input.credentials)
      const e = new ImapSyncEngine(tmp)
      await e.connect(); await e.disconnect()
      await verifySmtp(tmp)
      return { ok: true }
    } catch (e: any) { log.warn('accounts', 'test', input.email, e?.message ?? e); return { ok: false, error: e?.message ?? String(e) } }
    finally { try { Credentials.remove(`account:${tmp.id}`) } catch {} }
  })
}