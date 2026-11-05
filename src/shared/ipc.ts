// src/shared/ipc.ts
import type { Account, AccountInput } from './models/Account'
import type { Folder } from './models/Folder'
import type { ThreadFilter } from './search'
import type { AiReply, AiReplyStatus } from './models/AiReply'
import type { Rule } from './models/Rule'
import type { Thread } from './models/Thread'
import type { Message, MessageHeader, Address } from './models/Message'
import type { Draft, OutboxItem } from './models/Draft'
import type { Signature } from './models/Signature'
import type { AiSettings } from './ai/AiSettings'
import type { AiTask } from './ai/AiTask'
import type { AiModelInfo } from './ai/AiProvider'
import type { Source, SourceInput } from './models/Source'
import type { Contact, ContactInput } from './models/Contact'
import type { Calendar, CalEvent, EventInput, Invitation, CaldavInput } from './models/Calendar'

export interface AppSettings {
  theme: 'system' | 'light' | 'dark'
  density: 'comfortable' | 'compact'
  loadRemoteImages: boolean
  undoSendSeconds: number
  markReadDelayMs: number
  collectAddresses: boolean
  fullTextIndex: boolean
  confirmSend: boolean
  autoUpdate: boolean
  fontSize: 'small' | 'normal' | 'large'   // taille des textes de l'interface
  composeSurface: 'light' | 'theme'       // fond des zones de rédaction (réponse IA, composeur, signature)
  purgeSpamDays: number    // 0 = jamais
  purgeTrashDays: number   // 0 = jamais
}

export interface AiRunInput {
  task: AiTask
  accountId: string
  threadId?: string
  messageId?: string
  userPrompt?: string
  global?: boolean   // question sur toute la boîte, sans fil ouvert
  history?: { role: 'user' | 'assistant'; content: string }[]
  lastRefs?: string[]   // messages cités par la réponse précédente (questions de suite)
  selection?: string
  draftHtml?: string
  auto?: boolean
}

export interface ThreadEvent {
  kind: 'reply' | 'forward'
  parentMessageId: string
  childMessageId: string
  childThreadId: string | null
  childSubject: string
  to: Address[]
  date: number
}

export interface DetectedEvent { summary: string; start: number; end: number; allDay: boolean; location: string; confidence: 'high' | 'medium' }

export interface SyncStatus {
  accountId: string
  state: 'idle' | 'syncing' | 'error' | 'offline'
  error?: string
  lastSync?: number
}

export interface IpcInvoke {
  'accounts:list': () => Account[]
  'accounts:add': (input: AccountInput) => Account
  'accounts:update': (id: string, patch: Partial<Account>) => Account
  'accounts:remove': (id: string) => void
  'accounts:reorder': (orderedIds: string[]) => void
  'accounts:oauth': (provider: 'google' | 'microsoft') => { email: string; name: string; accessToken: string; refreshToken: string; expiresAt: number }
  'accounts:test': (input: AccountInput) => { ok: boolean; error?: string }

  'folders:list': (accountId: string) => Folder[]
  'folders:create': (accountId: string, name: string, parentFolderId: string | null) => Folder
  'folders:rename': (folderId: string, name: string) => Folder
  'folders:move': (folderId: string, newParentFolderId: string | null) => Folder
  'folders:delete': (folderId: string) => void
  'folders:info': (folderId: string) => { total: number; subfolders: number }
  'folders:deleteWithContents': (folderId: string) => { moved: number }
  'folders:empty': (folderId: string) => number
  'folders:reorder': (orderedIds: string[]) => void
  'messages:moveToFolder': (ids: string[], folderId: string) => void
  'threads:list': (q: { accountId?: string; folderId?: string; role?: string; search?: string; filter?: ThreadFilter; limit: number; offset: number }) => Thread[]
  'threads:get': (threadId: string) => { thread: Thread; messages: Message[]; events: ThreadEvent[] }
  'threads:messageIds': (threadIds: string[]) => string[]
  'messages:body': (messageId: string) => Message
  'messages:flag': (ids: string[], patch: { unread?: boolean; starred?: boolean }) => void
  'messages:move': (ids: string[], folderRole: string) => void
  'messages:delete': (ids: string[]) => void
  'attachments:open': (attachmentId: string) => void
  'attachments:save': (attachmentId: string) => string | null
  'sync:now': (accountId?: string) => void
  'sync:reset': (accountId: string) => void
  'sync:status': () => SyncStatus[]

  'drafts:list': (accountId?: string) => Draft[]
  'drafts:save': (draft: Draft) => Draft
  'drafts:delete': (id: string) => void
  'drafts:keep': (draft: Draft) => Draft
  'drafts:fromMessage': (messageId: string) => Draft
  'drafts:send': (draft: Draft) => OutboxItem
  'outbox:cancel': (id: string) => boolean
  'compose:pickAttachments': () => string[]
  'compose:open': (draftId: string) => void
  'compose:pickImage': () => string | null

  'signatures:list': () => Signature[]
  'signatures:save': (s: Signature) => Signature
  'signatures:delete': (id: string) => void

  'update:state': () => UpdateState
  'update:check': () => UpdateState
  'update:install': () => void

  'replies:list': (statuses?: AiReplyStatus[]) => AiReply[]
  'replies:restore': (messageId: string) => void
  'replies:counts': () => { ready: number; generating: number }
  'replies:candidates': (opts?: { accountId?: string; limit?: number; days?: number }) => number
  'replies:forThread': (threadId: string) => AiReply | null
  'replies:generate': (opts?: { accountId?: string; limit?: number; days?: number }) => { queued: number }
  'replies:retry': (messageId: string) => void
  'replies:stop': () => void
  'replies:dismiss': (messageId: string) => void
  'replies:update': (messageId: string, text: string) => void
  'replies:markSent': (threadId: string) => void
  'muted:list': () => { address: string; createdAt: number }[]
  'muted:toggle': (address: string) => boolean   // renvoie l'état après bascule
  'muted:remove': (address: string) => void

  'settings:get': () => AppSettings
  'settings:set': (patch: Partial<AppSettings>) => AppSettings
  'ai:settings:get': () => AiSettings
  'ai:settings:set': (patch: Partial<AiSettings>) => AiSettings
  'ai:setKey': (kind: string, key: string) => void
  'ai:models': () => AiModelInfo[]
  'ai:healthcheck': () => boolean
  'ai:run': (input: AiRunInput, streamId: string) => string
  'ai:cancel': (streamId: string) => void
  'ai:extractEvent': (messageId: string) => DetectedEvent | null

  'sources:list': () => Source[]
  'sources:save': (s: SourceInput) => Source
  'sources:delete': (id: string) => void
  'sources:test': (id: string) => { ok: boolean; preview?: string; error?: string }
  'sources:pickFile': () => string | null

  'contacts:list': (q?: string) => Contact[]
  'contacts:save': (c: ContactInput) => Contact
  'contacts:delete': (id: string) => void
  'contacts:suggest': (q: string) => { name: string; address: string }[]
  'contacts:count': () => number
  'contacts:import': () => { imported: number; updated: number; skipped: number }
  'contacts:export': (format: 'csv' | 'vcf') => string | null
  'contacts:syncGoogle': (accountId: string) => { imported: number; updated: number }

  'calendar:calendars': () => Calendar[]
  'calendar:saveCalendar': (c: Partial<Calendar> & { kind: Calendar['kind']; name: string }) => Calendar
  'calendar:removeCalendar': (id: string) => void
  'calendar:occurrences': (from: number, to: number) => (CalEvent & { occStart: number; occEnd: number; color: string; calendarName: string })[]
  'calendar:saveEvent': (e: EventInput) => CalEvent
  'calendar:deleteEvent': (id: string) => void
  'calendar:sync': () => string[]
  'calendar:addGoogle': (accountId: string) => Calendar[]
  'calendar:addCaldav': (input: CaldavInput) => Calendar[]
  'calendar:addMicrosoft': (accountId: string) => Calendar[]
  'calendar:invitation': (messageId: string) => Invitation | null
  'calendar:respond': (messageId: string, status: 'accepted' | 'declined' | 'tentative') => void
  'geo:suggest': (q: string) => { label: string; city: string; postcode: string; country: string }[]

  'chats:list': () => { id: string; title: string; pinned: boolean; updatedAt: number }[]
  'chats:get': (id: string) => { id: string; title: string; turns: unknown[]; pinned: boolean; updatedAt: number } | null
  'chats:save': (c: { id: string; title: string; turns: unknown[]; pinned?: boolean }) => void
  'chats:delete': (id: string) => void
  'chats:pin': (id: string, pinned: boolean) => void

  'rules:list': () => Rule[]
  'rules:save': (rule: Rule) => Rule
  'rules:delete': (ruleId: string) => void
  'rules:reorder': (ids: string[]) => void
  'rules:run': (opts: { ruleId?: string; accountId?: string; days?: number }) => { touched: number; moved: number }
  'folders:setRetention': (folderId: string, days: number | null) => void
  'blocked:list': () => { address: string; createdAt: number }[]
  'blocked:add': (addresses: string[]) => void
  'blocked:remove': (address: string) => void

  'backup:export': (passphrase: string) => string | null
  'backup:import': (passphrase: string) => { accounts: number; contacts: number; signatures: number; sources: number; events: number }
  'thunderbird:profiles': () => string[]
  'thunderbird:read': (path: string) => { path: string; accounts: { email: string; name: string; username: string; imap: { host: string; port: number; secure: boolean }; smtp: { host: string; port: number; secure: boolean }; signatureHtml: string; provider: string; oauth: 'google' | 'microsoft' | null }[]; addressBooks: string[] }
  'thunderbird:pick': () => string | null
  'thunderbird:importBooks': (paths: string[]) => { imported: number; updated: number }
}

export interface IpcEvents {
  'sync:status': SyncStatus
  'mail:changed': { accountId: string; folderIds?: string[]; threadIds?: string[] }
  'outbox:changed': OutboxItem
  'ai:token': { streamId: string; token: string }
  'ai:done': { streamId: string; text: string }
  'ai:error': { streamId: string; error: string }
  'ai:tool': { streamId: string; label: string }
  'calendar:changed': Record<string, never>
  'ai:refs': { streamId: string; refs: { messageId: string; threadId: string; subject: string; from: string; date: number; account: string }[] }
  'notify': { title: string; body: string; threadId: string }
  'update:state': UpdateState
  'replies:changed': { ready: number; generating: number }
}

export type { Account, AccountInput, Folder, Thread, Message, MessageHeader, Draft, OutboxItem, Signature, AiSettings, AiTask, AiModelInfo }

export interface UpdateState {
  status: 'idle' | 'disabled' | 'checking' | 'up-to-date' | 'downloading' | 'ready' | 'error'
  current: string
  version?: string
  notes?: string
  progress?: number
  error?: string
  checkedAt?: number
}