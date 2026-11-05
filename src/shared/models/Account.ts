// src/shared/models/Account.ts
export type AuthMethod = 'password' | 'oauth-google' | 'oauth-microsoft'
export type ProviderPreset = 'gmail' | 'outlook' | 'icloud' | 'ovh' | 'custom'

export interface ServerConfig {
  host: string
  port: number
  secure: boolean
}

export interface Account {
  googleData?: boolean         // Google Agenda/Contacts connectés (compte OAuth, ou connexion dédiée sur un compte Gmail IMAP)
  id: string
  email: string
  name: string
  provider: ProviderPreset
  auth: AuthMethod
  imap: ServerConfig
  smtp: ServerConfig
  color: string
  defaultSignatureId: string | null
  aiInstructions: string
  purgeSpamDays: number | null    // null = réglage général ; 0 = jamais
  purgeTrashDays: number | null
  createdAt: number
}

export interface AccountCredentials {
  password?: string
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
}

export interface AccountInput {
  email: string
  name: string
  provider: ProviderPreset
  auth: AuthMethod
  imap: ServerConfig
  smtp: ServerConfig
  credentials: AccountCredentials
}