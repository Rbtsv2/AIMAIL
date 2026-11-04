// src/shared/models/Message.ts
import type { Attachment } from './Attachment'

export interface Address {
  name: string
  address: string
}

export interface Message {
  id: string
  accountId: string
  folderId: string
  threadId: string
  uid: number
  messageId: string
  inReplyTo: string | null
  references: string[]
  from: Address
  to: Address[]
  cc: Address[]
  bcc: Address[]
  replyTo: Address[]
  subject: string
  snippet: string
  date: number
  unread: boolean
  starred: boolean
  hasAttachments: boolean
  bodyHtml: string | null
  bodyText: string | null
  bodyFetched: boolean
  category: string | null
  attachments: Attachment[]
}

export type MessageHeader = Omit<Message, 'bodyHtml' | 'bodyText' | 'attachments'>