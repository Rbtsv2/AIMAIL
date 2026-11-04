// src/shared/models/Attachment.ts
export interface Attachment {
  id: string
  messageId: string
  filename: string
  mimeType: string
  size: number
  contentId: string | null
  inline: boolean
  partId: string
  localPath: string | null
  text?: string | null
}