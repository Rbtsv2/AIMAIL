// src/renderer/src/stores/chat.store.ts
import { create } from 'zustand'
import { invoke } from '@/lib/api'

export interface MailRef { messageId: string; threadId: string; subject: string; from: string; date: number; account: string }
export interface Turn { id: string; role: 'user' | 'assistant'; content: string; refs: MailRef[]; streaming?: boolean; error?: string; tool?: string | null; steps?: string[] }
export interface ChatMeta { id: string; title: string; pinned: boolean; updatedAt: number }

interface S {
  chatId: string | null
  activeTurnId: string | null
  turns: Turn[]
  list: ChatMeta[]
  loadList(): Promise<void>
  open(id: string): Promise<void>
  add(t: Turn): void
  update(id: string, patch: Partial<Turn>): void
  appendRefs(id: string, refs: MailRef[]): void
  addStep(id: string, step: string): void
  clear(): void
  remove(id: string): Promise<void>
  pin(id: string, pinned: boolean): Promise<void>
  persist(): Promise<void>
  setActive(id: string | null): void
  focusTick: number
  panel: { refs: MailRef[]; open: boolean }
  openPanel(refs: MailRef[]): void
  closePanel(): void
}

let saveTimer: number | null = null
const schedule = (fn: () => void) => { if (saveTimer) window.clearTimeout(saveTimer); saveTimer = window.setTimeout(fn, 600) }

export const useChat = create<S>((set, get) => ({
  chatId: null, activeTurnId: null, turns: [], list: [], focusTick: 0,
  panel: { refs: [], open: false },
  openPanel: (refs) => set({ panel: { refs, open: true } }),
  closePanel: () => set((s) => ({ panel: { ...s.panel, open: false } })),
  setActive: (activeTurnId) => set({ activeTurnId }),
  loadList: async () => set({ list: await invoke('chats:list') }),
  open: async (id) => { const c = await invoke('chats:get', id); if (c) set({ chatId: c.id, turns: (c.turns as Turn[]).map((t) => ({ ...t, streaming: false, tool: null })) }) },
  add: (t) => { set((s) => ({ turns: [...s.turns, t], chatId: s.chatId ?? crypto.randomUUID() })); schedule(() => void get().persist()) },
  update: (id, patch) => { set((s) => ({ turns: s.turns.map((t) => (t.id === id ? { ...t, ...patch } : t)) })); if (patch.streaming === false || patch.error) schedule(() => void get().persist()) },
  appendRefs: (id, refs) => set((s) => ({ turns: s.turns.map((t) => { if (t.id !== id) return t; const seen = new Set(t.refs.map((r) => r.threadId)); return { ...t, refs: [...t.refs, ...refs.filter((r) => !seen.has(r.threadId) && seen.add(r.threadId))] } }) })),
  addStep: (id, step) => set((s) => ({ turns: s.turns.map((t) => (t.id === id ? { ...t, tool: step, steps: [...(t.steps ?? []), step] } : t)) })),
  clear: () => set((s) => ({ chatId: null, turns: [], activeTurnId: null, focusTick: s.focusTick + 1 })),
  remove: async (id) => { await invoke('chats:delete', id); if (get().chatId === id) set((s) => ({ chatId: null, turns: [], activeTurnId: null, focusTick: s.focusTick + 1 })); await get().loadList() },
  pin: async (id, pinned) => { await invoke('chats:pin', id, pinned); await get().loadList() },
  persist: async () => {
    const { chatId, turns } = get()
    if (!chatId || !turns.length) return
    const title = turns.find((t) => t.role === 'user')?.content.slice(0, 80) ?? 'Conversation'
    await invoke('chats:save', { id: chatId, title, turns: turns.map((t) => ({ ...t, streaming: false, tool: null })) })
    await get().loadList()
  }
}))