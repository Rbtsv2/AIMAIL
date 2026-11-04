// src/shared/models/Folder.ts
export type FolderRole = 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam' | 'archive' | 'starred' | 'all' | 'custom'

export interface Folder {
  id: string
  accountId: string
  path: string
  name: string
  role: FolderRole
  delimiter: string
  unread: number
  total: number
  uidValidity: number
  uidNext: number
  sortOrder: number | null
  noselect: boolean
}