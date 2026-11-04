// src/main/auth/oauth/microsoftGraph.ts
// Jeton séparé du courrier : Azure n'accepte qu'une ressource par jeton (IMAP = outlook.office.com, agenda = graph.microsoft.com)
import { runOAuthFlow, refreshTokens, type OAuthConfig } from './OAuthFlow'
import { Credentials } from '../Credentials'

const cfg = (): OAuthConfig => ({
  clientId: process.env.MS_CLIENT_ID ?? '',
  authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  scopes: ['offline_access', 'openid', 'User.Read', 'Calendars.ReadWrite', 'Calendars.ReadWrite.Shared', 'Contacts.Read']
})

export async function graphAuthorize(accountId: string, loginHint?: string): Promise<void> {
  const t = await runOAuthFlow({ ...cfg(), extraAuthParams: loginHint ? { login_hint: loginHint, prompt: 'select_account' } : { prompt: 'select_account' } })
  Credentials.set(`msgraph:${accountId}`, JSON.stringify(t))
}

export async function graphToken(accountId: string): Promise<string> {
  const raw = Credentials.get(`msgraph:${accountId}`)
  if (!raw) throw new Error('GRAPH_NOT_AUTHORIZED')
  const t = JSON.parse(raw)
  if (t.expiresAt > Date.now()) return t.accessToken
  const n = await refreshTokens(cfg(), t.refreshToken)
  Credentials.set(`msgraph:${accountId}`, JSON.stringify({ ...t, ...n }))
  return n.accessToken
}

export const hasGraph = (accountId: string): boolean => !!Credentials.get(`msgraph:${accountId}`)