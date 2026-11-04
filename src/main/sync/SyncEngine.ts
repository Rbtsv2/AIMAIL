// src/main/sync/SyncEngine.ts
import type { Folder } from '@shared/models/Folder'
import type { Message } from '@shared/models/Message'

export interface SyncEngine {
  connect(): Promise<void>
  disconnect(): Promise<void>
  listFolders(): Promise<Folder[]>
  syncFolder(folder: Folder, opts: { limit?: number }): Promise<void>
  fetchBody(message: Message): Promise<{ html: string | null; text: string | null }>
  fetchAttachment(message: Message, partId: string): Promise<Buffer>
  setFlags(folder: Folder, uids: number[], patch: { unread?: boolean; starred?: boolean }): Promise<void>
  move(folder: Folder, uids: number[], target: Folder): Promise<Record<number, number>>
  delete(folder: Folder, uids: number[]): Promise<void>
  append(folder: Folder, raw: Buffer, flags: string[]): Promise<number | null>
  idle(folder: Folder, onChange: () => void): Promise<() => void>
  createMailbox(path: string): Promise<void>
  renameMailbox(oldPath: string, newPath: string): Promise<void>
  deleteMailbox(path: string): Promise<void>
}