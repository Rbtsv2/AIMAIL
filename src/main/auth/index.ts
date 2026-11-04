import type { Account } from '@shared/models/Account'
import { Credentials } from './Credentials'
import { googleRefresh } from './oauth/google'
import { microsoftRefresh } from './oauth/microsoft'

export interface LiveAuth {
  user: string
  pass?: string
  accessToken?: string
}

export async function resolveAuth(account: Account): Promise<LiveAuth> {
  const c = Credentials.getAccount(account.id)
  if (account.auth === 'password') return { user: account.email, pass: c.password }
  if (c.accessToken && c.expiresAt && c.expiresAt > Date.now()) return { user: account.email, accessToken: c.accessToken }
  if (!c.refreshToken) throw new Error('no refresh token')
  const t = account.auth === 'oauth-google' ? await googleRefresh(c.refreshToken) : await microsoftRefresh(c.refreshToken)
  Credentials.setAccount(account.id, { ...c, accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: t.expiresAt })
  return { user: account.email, accessToken: t.accessToken }
}
