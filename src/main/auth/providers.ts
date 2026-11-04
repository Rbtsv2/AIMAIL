import type { ProviderPreset, ServerConfig, AuthMethod } from '@shared/models/Account'

export interface Preset {
  label: string
  imap: ServerConfig
  smtp: ServerConfig
  auth: AuthMethod
}

export const PRESETS: Record<Exclude<ProviderPreset, 'custom'>, Preset> = {
  gmail: {
    label: 'Gmail',
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
    auth: 'oauth-google'
  },
  outlook: {
    label: 'Outlook / Microsoft 365',
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp.office365.com', port: 587, secure: false },
    auth: 'oauth-microsoft'
  },
  icloud: {
    label: 'iCloud',
    imap: { host: 'imap.mail.me.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.me.com', port: 587, secure: false },
    auth: 'password'
  },
  ovh: {
    label: 'OVH',
    imap: { host: 'ssl0.ovh.net', port: 993, secure: true },
    smtp: { host: 'ssl0.ovh.net', port: 465, secure: true },
    auth: 'password'
  }
}

export function guessPreset(email: string): ProviderPreset {
  const d = email.split('@')[1]?.toLowerCase() ?? ''
  if (/gmail\.com|googlemail\.com/.test(d)) return 'gmail'
  if (/outlook\.|hotmail\.|live\.|msn\./.test(d)) return 'outlook'
  if (/icloud\.com|me\.com|mac\.com/.test(d)) return 'icloud'
  return 'custom'
}
