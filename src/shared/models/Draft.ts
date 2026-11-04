// src/shared/models/Draft.ts
import type { Address } from './Message'

export interface Draft {
  id: string
  accountId: string
  threadId: string | null
  replyToMessageId: string | null
  forwardOfMessageId: string | null
  mode: 'new' | 'reply' | 'replyAll' | 'forward'
  to: Address[]
  cc: Address[]
  bcc: Address[]
  subject: string
  html: string
  text: string
  signatureId: string | null
  attachmentPaths: string[]
  imapFolderId: string | null
  imapUid: number | null
  updatedAt: number
}

export interface OutboxItem {
  id: string
  draft: Draft
  sendAt: number
  status: 'scheduled' | 'sending' | 'sent' | 'failed'
  error?: string
}