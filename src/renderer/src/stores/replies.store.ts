// src/renderer/src/stores/replies.store.ts
import { create } from 'zustand'
import type { AiReply } from '@shared/models/AiReply'
import { invoke } from '@/lib/api'

interface S {
  items: AiReply[]
  done: AiReply[]        // ignorées et répondues (onglets)
  tab: 'todo' | 'ignored' | 'sent'
  setTab(t: 'todo' | 'ignored' | 'sent'): void
  restore(messageId: string): Promise<void>
  counts: { ready: number; generating: number }
  mode: 'cards' | 'list'
  hubOpen: boolean
  load(): Promise<void>
  setCounts(c: { ready: number; generating: number }): void
  setMode(m: 'cards' | 'list'): void
  setHub(v: boolean): void
  generate(opts?: { accountId?: string }): Promise<number>
  stop(): Promise<void>
  dismiss(messageId: string): Promise<void>
  retry(messageId: string): Promise<void>
  forThread(threadId: string): AiReply | undefined
}

export const useReplies = create<S>((set, get) => ({
  items: [], done: [], tab: 'todo', counts: { ready: 0, generating: 0 }, mode: 'cards', hubOpen: false,
  setTab: (tab) => set({ tab }),
  restore: async (id) => { await invoke('replies:restore', id); await get().load() },
  load: async () => { const items = await invoke('replies:list'); const done = await invoke('replies:list', ['dismissed', 'sent']); set({ items, done, counts: { ready: items.filter((i) => i.status === 'ready').length, generating: items.filter((i) => i.status === 'pending' || i.status === 'generating').length } }) },
  setCounts: (counts) => { set({ counts }); void get().load() },
  setMode: (mode) => set({ mode }),
  setHub: (hubOpen) => set({ hubOpen }),
  generate: async (opts) => { const r = await invoke('replies:generate', opts); set({ hubOpen: true }); await get().load(); return r.queued },
  stop: async () => { await invoke('replies:stop'); await get().load() },
  dismiss: async (id) => { await invoke('replies:dismiss', id); await get().load() },
  retry: async (id) => { await invoke('replies:retry', id); await get().load() },
  forThread: (threadId) => get().items.find((i) => i.threadId === threadId && (i.status === 'ready' || i.status === 'generating' || i.status === 'pending'))
}))