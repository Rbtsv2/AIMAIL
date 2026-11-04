import { shell } from 'electron'
import { createServer } from 'http'
import { createHash, randomBytes } from 'crypto'
import { OAUTH_LOOPBACK_PORT } from '@shared/constants'

export interface OAuthConfig {
  clientId: string
  clientSecret?: string
  authUrl: string
  tokenUrl: string
  scopes: string[]
  extraAuthParams?: Record<string, string>
}

export interface OAuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
  idToken?: string
}

const b64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export async function runOAuthFlow(cfg: OAuthConfig): Promise<OAuthTokens> {
  const verifier = b64url(randomBytes(48))
  const challenge = b64url(createHash('sha256').update(verifier).digest())
  const state = b64url(randomBytes(16))
  const redirectUri = `http://127.0.0.1:${OAUTH_LOOPBACK_PORT}/callback`

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', redirectUri)
      if (url.pathname !== '/callback') { res.writeHead(404); res.end(); return }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<html><body style="font-family:-apple-system,system-ui;display:grid;place-items:center;height:100vh;margin:0;color:#1d1d1f"><p>Connexion réussie. Vous pouvez fermer cette fenêtre.</p></body></html>')
      server.close()
      if (url.searchParams.get('state') !== state) return reject(new Error('state mismatch'))
      const err = url.searchParams.get('error')
      if (err) return reject(new Error(err))
      resolve(url.searchParams.get('code') ?? '')
    })
    server.listen(OAUTH_LOOPBACK_PORT, '127.0.0.1', () => {
      const u = new URL(cfg.authUrl)
      u.searchParams.set('client_id', cfg.clientId)
      u.searchParams.set('redirect_uri', redirectUri)
      u.searchParams.set('response_type', 'code')
      u.searchParams.set('scope', cfg.scopes.join(' '))
      u.searchParams.set('code_challenge', challenge)
      u.searchParams.set('code_challenge_method', 'S256')
      u.searchParams.set('state', state)
      for (const [k, v] of Object.entries(cfg.extraAuthParams ?? {})) u.searchParams.set(k, v)
      shell.openExternal(u.toString())
    })
    setTimeout(() => { server.close(); reject(new Error('timeout')) }, 5 * 60 * 1000)
  })

  return exchange(cfg, { grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verifier })
}

export async function refreshTokens(cfg: OAuthConfig, refreshToken: string): Promise<OAuthTokens> {
  const t = await exchange(cfg, { grant_type: 'refresh_token', refresh_token: refreshToken })
  return { ...t, refreshToken: t.refreshToken || refreshToken }
}

async function exchange(cfg: OAuthConfig, params: Record<string, string>): Promise<OAuthTokens> {
  const body = new URLSearchParams({ client_id: cfg.clientId, ...params })
  if (cfg.clientSecret) body.set('client_secret', cfg.clientSecret)
  const res = await fetch(cfg.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
  if (!res.ok) throw new Error(`oauth token ${res.status}: ${await res.text()}`)
  const json = (await res.json()) as any
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? '',
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 - 60_000,
    idToken: json.id_token
  }
}
