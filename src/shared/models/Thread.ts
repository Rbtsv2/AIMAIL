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
  // suivi des réponses : le dernier message est-il de nous ? réponse préparée par l'assistant ?
  lastFromMe: boolean
  replyState: 'pending' | 'generating' | 'ready' | 'dismissed' | 'error' | 'sent' | null
}