// src/shared/models/Thread.ts
import type { Address } from './Message'

export interface Thread {
  id: string
  accountId: string
  subject: string
  snippet: string
  participants: Address[]
  lastDate: number
  messageCount: number
  unread: boolean
  starred: boolean
  hasAttachments: boolean
  folderIds: string[]
  category: string | null
}