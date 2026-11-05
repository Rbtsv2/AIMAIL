// src/main/auth/index.ts
import type { Account } from '@shared/models/Account'
import { Credentials } from './Credentials'
import { googleRefresh, googleDataRefresh } from './oauth/google'
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

/** Jeton pour Google Agenda/Contacts : celui du compte OAuth, ou la connexion « données Google » rattachée à un compte IMAP. */
export function hasGoogleData(account: Account): boolean {
  if (account.auth === 'oauth-google') return true
  const v = Credentials.get(`google-data:${account.id}`); const c = v ? JSON.parse(v) : null
  return !!c?.refreshToken
}
export async function resolveGoogleData(account: Account): Promise<LiveAuth> {
  if (account.auth === 'oauth-google') return resolveAuth(account)
  const key = `google-data:${account.id}`
  const raw = Credentials.get(key); const c = raw ? JSON.parse(raw) : {}
  if (!c.refreshToken) throw new Error('Google Agenda et Contacts ne sont pas connectés pour ce compte : Réglages → Comptes → « Connecter Google Agenda et Contacts »')
  if (c.accessToken && c.expiresAt && c.expiresAt > Date.now()) return { user: account.email, accessToken: c.accessToken }
  const t = await googleDataRefresh(c.refreshToken)
  Credentials.set(key, JSON.stringify({ ...c, accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: t.expiresAt }))
  return { user: account.email, accessToken: t.accessToken }
}