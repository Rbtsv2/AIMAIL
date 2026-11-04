// src/main/auth/oauth/google.ts
import { runOAuthFlow, refreshTokens, type OAuthConfig, type OAuthTokens } from './OAuthFlow'

export const googleConfig = (): OAuthConfig => ({
  clientId: process.env.GOOGLE_CLIENT_ID ?? '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scopes: ['https://mail.google.com/', 'https://www.googleapis.com/auth/contacts.readonly', 'https://www.googleapis.com/auth/calendar', 'openid', 'email', 'profile'],
  extraAuthParams: { access_type: 'offline', prompt: 'consent' }
})

export async function googleLogin(): Promise<OAuthTokens & { email: string; name: string }> {
  const t = await runOAuthFlow(googleConfig())
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${t.accessToken}` } })
  const u = (await res.json()) as any
  return { ...t, email: u.email, name: u.name ?? u.email }
}

export const googleRefresh = (refreshToken: string) => refreshTokens(googleConfig(), refreshToken)