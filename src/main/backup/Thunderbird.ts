// src/main/backup/Thunderbird.ts
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { ProviderPreset } from '@shared/models/Account'
import { cleanSignatureHtml } from '@shared/signature'

export interface TbAccount { email: string; name: string; username: string; imap: { host: string; port: number; secure: boolean }; smtp: { host: string; port: number; secure: boolean }; signatureHtml: string; provider: ProviderPreset; oauth: 'google' | 'microsoft' | null }
export interface TbProfile { path: string; accounts: TbAccount[]; addressBooks: string[] }

export function findProfiles(): string[] {
  const roots = [join(homedir(), '.thunderbird'), join(homedir(), 'snap', 'thunderbird', 'common', '.thunderbird'), join(homedir(), '.var', 'app', 'org.mozilla.Thunderbird', '.thunderbird'),
    join(homedir(), 'Library', 'Thunderbird', 'Profiles'), join(process.env.APPDATA ?? '', 'Thunderbird', 'Profiles')]
  const out: string[] = []
  for (const r of roots) {
    if (!r || !existsSync(r)) continue
    for (const d of readdirSync(r)) { const p = join(r, d); try { if (statSync(p).isDirectory() && existsSync(join(p, 'prefs.js'))) out.push(p) } catch {} }
  }
  return out
}

function readPrefs(path: string): Map<string, string | number | boolean> {
  const m = new Map<string, string | number | boolean>()
  const text = readFileSync(path, 'utf8')
  for (const line of text.matchAll(/user_pref\("([^"]+)",\s*(.+?)\);\s*$/gm)) {
    const k = line[1]; let v: any = line[2].trim()
    if (v === 'true') v = true; else if (v === 'false') v = false; else if (/^-?\d+$/.test(v)) v = +v; else v = v.replace(/^"|"$/g, '').replace(/\\u([0-9a-fA-F]{4})/g, (_m: string, h: string) => String.fromCharCode(parseInt(h, 16))).replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    m.set(k, v)
  }
  return m
}

const guessProvider = (host: string, email: string): ProviderPreset => /gmail|google/i.test(host) ? 'gmail' : /office365|outlook|hotmail|live\.com/i.test(host) ? 'outlook' : /mail\.me\.com|icloud/i.test(host) ? 'icloud' : /ovh\.net/i.test(host) ? 'ovh' : /gmail\.com$/i.test(email) ? 'gmail' : 'custom'

export function readProfile(path: string): TbProfile {
  const p = readPrefs(join(path, 'prefs.js'))
  const g = (k: string) => p.get(k)
  const accounts: TbAccount[] = []
  const ids = String(g('mail.accountmanager.accounts') ?? '').split(',').filter(Boolean)
  for (const acc of ids) {
    const server = String(g(`mail.account.${acc}.server`) ?? '')
    const type = String(g(`mail.server.${server}.type`) ?? '')
    if (type !== 'imap') continue
    const idList = String(g(`mail.account.${acc}.identities`) ?? '').split(',').filter(Boolean)
    const idKey = idList[0]
    if (!idKey) continue
    const email = String(g(`mail.identity.${idKey}.useremail`) ?? '')
    if (!email) continue
    const imapHost = String(g(`mail.server.${server}.hostname`) ?? '')
    const imapPort = Number(g(`mail.server.${server}.port`) ?? 993)
    const imapSocket = Number(g(`mail.server.${server}.socketType`) ?? 3)
    const smtpKey = String(g(`mail.identity.${idKey}.smtpServer`) ?? g('mail.smtp.defaultserver') ?? '')
    const smtpHost = String(g(`mail.smtpserver.${smtpKey}.hostname`) ?? '')
    const smtpPort = Number(g(`mail.smtpserver.${smtpKey}.port`) ?? 587)
    const smtpSocket = Number(g(`mail.smtpserver.${smtpKey}.try_ssl`) ?? 2)
    const authMethod = Number(g(`mail.server.${server}.authMethod`) ?? 3)
    let signatureHtml = String(g(`mail.identity.${idKey}.htmlSigText`) ?? '')
    const sigFile = String(g(`mail.identity.${idKey}.sig_file`) ?? '')
    if (!signatureHtml && sigFile && existsSync(sigFile)) { try { signatureHtml = readFileSync(sigFile, 'utf8') } catch {} }
    if (signatureHtml && !/<[a-z]/i.test(signatureHtml)) signatureHtml = signatureHtml.replace(/\n/g, '<br>')
    else signatureHtml = cleanSignatureHtml(signatureHtml)
    const provider = guessProvider(imapHost, email)
    accounts.push({
      email, name: String(g(`mail.identity.${idKey}.fullName`) ?? ''), username: String(g(`mail.server.${server}.userName`) ?? email),
      imap: { host: imapHost, port: imapPort, secure: imapSocket === 3 }, smtp: { host: smtpHost, port: smtpPort, secure: smtpSocket === 3 },
      signatureHtml, provider, oauth: authMethod === 10 ? (provider === 'gmail' ? 'google' : provider === 'outlook' ? 'microsoft' : null) : null
    })
  }
  const addressBooks = ['abook.sqlite', 'history.sqlite', 'abook.mab', 'history.mab'].map((f) => join(path, f)).filter(existsSync)
  return { path, accounts, addressBooks }
}