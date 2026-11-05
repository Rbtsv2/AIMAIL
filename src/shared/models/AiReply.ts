// src/shared/models/AiReply.ts
export type AiReplyStatus = 'pending' | 'generating' | 'ready' | 'sent' | 'dismissed' | 'error'
export interface AiReply {
  messageId: string
  threadId: string
  accountId: string
  text: string
  status: AiReplyStatus
  error: string | null
  createdAt: number
  updatedAt: number
  // contexte du message, pour les cartes
  subject: string
  from: string
  fromAddress: string
  date: number
  snippet: string
}