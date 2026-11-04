import { runOAuthFlow, refreshTokens, type OAuthConfig, type OAuthTokens } from './OAuthFlow'

export const microsoftConfig = (): OAuthConfig => ({
  clientId: process.env.MS_CLIENT_ID ?? '',
  authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  scopes: [
    'offline_access', 'openid', 'email', 'profile',
    'https://outlook.office.com/IMAP.AccessAsUser.All',
    'https://outlook.office.com/SMTP.Send'
  ]
})

export async function microsoftLogin(): Promise<OAuthTokens & { email: string; name: string }> {
  const t = await runOAuthFlow(microsoftConfig())
  const payload = t.idToken ? JSON.parse(Buffer.from(t.idToken.split('.')[1], 'base64').toString()) : {}
  const email = payload.preferred_username ?? payload.email ?? ''
  return { ...t, email, name: payload.name ?? email }
}

export const microsoftRefresh = (refreshToken: string) => refreshTokens(microsoftConfig(), refreshToken)
