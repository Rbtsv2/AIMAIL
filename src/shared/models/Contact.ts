// src/shared/models/Contact.ts
export type ContactSource = 'manual' | 'import' | 'google' | 'auto'

export interface Contact {
  id: string
  accountId: string | null
  firstName: string
  lastName: string
  displayName: string
  emails: string[]
  phones: string[]
  org: string
  title: string
  notes: string
  source: ContactSource
  googleId: string | null
  starred: boolean
  updatedAt: number
}

export type ContactInput = Omit<Contact, 'updatedAt' | 'id'> & { id?: string }
export type ImportFormat = 'csv' | 'tsv' | 'vcf' | 'ldif' | 'sqlite' | 'mab'