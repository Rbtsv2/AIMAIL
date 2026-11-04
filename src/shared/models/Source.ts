// src/shared/models/Source.ts
export type SourceKind = 'api' | 'url' | 'file'
export type SourceAuthKind = 'none' | 'basic' | 'bearer' | 'header' | 'cookie'

export interface Source {
  id: string
  accountIds: string[]   // vide = tous les comptes
  kind: SourceKind
  name: string
  description: string
  urls: string[]
  method: 'GET' | 'POST'
  bodyTemplate: string
  authKind: SourceAuthKind
  filePath: string
  enabled: boolean
  cachedText: string | null
  cachedAt: number | null
  hasSecret: boolean
  createdAt: number
}

export interface SourceSecret {
  username?: string
  password?: string
  token?: string
  headerName?: string
  headerValue?: string
  cookie?: string
}

export type SourceInput = Omit<Source, 'cachedText' | 'cachedAt' | 'hasSecret' | 'createdAt'> & { secret?: SourceSecret }