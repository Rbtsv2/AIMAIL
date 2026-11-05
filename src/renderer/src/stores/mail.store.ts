// src/renderer/src/stores/mail.store.ts
import { create } from 'zustand'
import type { ThreadFilter } from '@shared/search'
import type { Thread } from '@shared/models/Thread'
import type { Message } from '@shared/models/Message'
import type { ThreadEvent } from '@shared/ipc'
import { invoke } from '@/lib/api'
import { useUi } from './ui.store'

export interface View { accountId?: string; folderId?: string; role?: string; label: string }

interface S {
  view: View
  search: string
  threads: Thread[]
  loading: boolean
  viewKey: string          // clé de la vue dont « threads » est le résultat (évite le squelette à chaque resynchro)
  filter: ThreadFilter
  setFilter(patch: Partial<ThreadFilter>): void
  clearFilter(): void
  hasMore: boolean
  selectedId: string | null
  selection: string[]
  anchorId: string | null
  current: { thread: Thread; messages: Message[]; events: ThreadEvent[] } | null
  setView(v: View): void
  setSearch(q: string): void
  refresh(): Promise<void>
  loadMore(): Promise<void>
  select(id: string | null): Promise<void>
  reloadCurrent(): Promise<void>
  flag(ids: string[], patch: { unread?: boolean; starred?: boolean }): Promise<void>
  archive(threadId: string): Promise<void>
  trash(threadId: string): Promise<void>
  selectRelative(delta: number): void
  removeLocal(threadId: string): void
  deleteForever(threadId: string): Promise<void>
  clickSelect(id: string, mods: { ctrl: boolean; shift: boolean }): void
  clearSelection(): void
  bulk(action: 'archive' | 'trash' | 'delete' | 'read' | 'unread' | 'star' | 'unstar' | 'spam' | 'inbox' | 'folder', folderId?: string): Promise<void>
}

const PAGE = 60

export const useMail = create<S>((set, get) => ({
  view: { role: 'inbox', label: 'Réception' }, search: '', threads: [], loading: false, viewKey: '', filter: {}, hasMore: true, selectedId: null, selection: [], anchorId: null, current: null,
  setView: (view) => { useUi.getState().closeSettings(); useUi.getState().setAddAccount(false); useUi.getState().setContacts(false); useUi.getState().setCalendar(false); set({ view, search: '', selectedId: null, selection: [], anchorId: null, current: null }); void get().refresh() },
  setSearch: (search) => { set({ search }); void get().refresh() },
  setFilter: (patch) => { const f = { ...get().filter, ...patch }; for (const k of Object.keys(f) as (keyof ThreadFilter)[]) if (f[k] === undefined || f[k] === false || f[k] === '') delete f[k]; set({ filter: f }); void get().refresh() },
  clearFilter: () => { set({ filter: {} }); void get().refresh() },
  refresh: async () => {
    const { view, search, filter } = get()
    const key = `${view.accountId ?? ''}|${view.folderId ?? ''}|${view.role ?? ''}|${search}|${JSON.stringify(filter)}`
    // squelette uniquement au premier chargement d'une vue ; une resynchro en arrière-plan ne fait pas clignoter « Rien ici »
    if (get().viewKey !== key) set({ loading: true, threads: [] })
    const threads = await invoke('threads:list', { accountId: view.accountId, folderId: view.folderId, role: view.role, search, filter, limit: PAGE, offset: 0 })
    const cur = get()
    const curKey = `${cur.view.accountId ?? ''}|${cur.view.folderId ?? ''}|${cur.view.role ?? ''}|${cur.search}|${JSON.stringify(cur.filter)}`
    if (curKey !== key) return   // la vue a changé entre-temps : résultat obsolète
    set({ threads, loading: false, viewKey: key, hasMore: threads.length === PAGE })
  },
  loadMore: async () => {
    const { view, search, filter, threads, hasMore, loading } = get()
    if (!hasMore || loading) return
    set({ loading: true })
    const more = await invoke('threads:list', { accountId: view.accountId, folderId: view.folderId, role: view.role, search, filter, limit: PAGE, offset: threads.length })
    set({ threads: [...threads, ...more], loading: false, hasMore: more.length === PAGE })
  },
  select: async (id) => {
    if (id) { useUi.getState().closeSettings(); useUi.getState().setAddAccount(false); useUi.getState().setContacts(false); useUi.getState().setCalendar(false) }
    set({ selectedId: id, selection: id ? [id] : [], anchorId: id })
    if (!id) { set({ current: null }); return }
    const cur = await invoke('threads:get', id)
    set({ current: cur })
  },
  reloadCurrent: async () => { const id = get().selectedId; if (id) set({ current: await invoke('threads:get', id) }) },
  flag: async (ids, patch) => { await invoke('messages:flag', ids, patch) },
  removeLocal: (threadId) => set((s) => ({ threads: s.threads.filter((t) => t.id !== threadId), selection: s.selection.filter((x) => x !== threadId) })),
  clickSelect: (id, mods) => {
    const { threads, selection, anchorId } = get()
    if (mods.shift && anchorId) {
      const a = threads.findIndex((t) => t.id === anchorId), b = threads.findIndex((t) => t.id === id)
      if (a >= 0 && b >= 0) { const [lo, hi] = a < b ? [a, b] : [b, a]; set({ selection: threads.slice(lo, hi + 1).map((t) => t.id), selectedId: id }); return }
    }
    if (mods.ctrl) {
      const next = selection.includes(id) ? selection.filter((x) => x !== id) : [...selection, id]
      set({ selection: next, anchorId: id, selectedId: next.length === 1 ? next[0] : get().selectedId })
      if (next.length === 1) void get().select(next[0])
      return
    }
    void get().select(id)
  },
  clearSelection: () => set((s) => ({ selection: s.selectedId ? [s.selectedId] : [] })),
  bulk: async (action, folderId) => {
    const ids = [...get().selection]
    if (!ids.length) return
    const msgIds = await invoke('threads:messageIds', ids)
    const removes = ['archive', 'trash', 'delete', 'spam', 'inbox', 'folder'].includes(action)
    if (removes) { for (const t of ids) get().removeLocal(t); set({ selection: [], selectedId: null, current: null }) }
    try {
      if (action === 'archive') await invoke('messages:move', msgIds, 'archive')
      else if (action === 'trash') await invoke('messages:move', msgIds, 'trash')
      else if (action === 'spam') await invoke('messages:move', msgIds, 'spam')
      else if (action === 'inbox') await invoke('messages:move', msgIds, 'inbox')
      else if (action === 'delete') await invoke('messages:delete', msgIds)
      else if (action === 'folder' && folderId) await invoke('messages:moveToFolder', msgIds, folderId)
      else if (action === 'read') await invoke('messages:flag', msgIds, { unread: false })
      else if (action === 'unread') await invoke('messages:flag', msgIds, { unread: true })
      else if (action === 'star') await invoke('messages:flag', msgIds, { starred: true })
      else if (action === 'unstar') await invoke('messages:flag', msgIds, { starred: false })
      const n = ids.length
      const label: Record<string, string> = { archive: 'archivées', trash: 'supprimées', delete: 'supprimées définitivement', spam: 'signalées', inbox: 'restaurées', folder: 'déplacées', read: 'marquées lues', unread: 'marquées non lues', star: 'suivies', unstar: 'ne sont plus suivies' }
      useUi.getState().toast({ text: `${n} conversation${n > 1 ? 's' : ''} ${label[action]}`, ttl: 1800 })
    } catch (e: any) { useUi.getState().toast({ text: String(e?.message ?? e).replace(/^Error invoking remote method '[^']+': Error: /, ''), ttl: 6000 }); void get().refresh() }
  },
  deleteForever: async (threadId) => {
    const t = get().current
    const ids = t && t.thread.id === threadId ? t.messages.map((m) => m.id) : (await invoke('threads:get', threadId)).messages.map((m) => m.id)
    get().selectRelative(1)
    get().removeLocal(threadId)
    try { await invoke('messages:delete', ids); useUi.getState().toast({ text: 'Supprimé définitivement', ttl: 1500 }) } catch (e: any) { useUi.getState().toast({ text: String(e?.message ?? e).replace(/^Error invoking remote method '[^']+': Error: /, ''), ttl: 6000 }); void get().refresh() }
  },
  archive: async (threadId) => {
    const t = get().current
    const ids = t && t.thread.id === threadId ? t.messages.map((m) => m.id) : (await invoke('threads:get', threadId)).messages.map((m) => m.id)
    get().selectRelative(1)
    get().removeLocal(threadId)
    try { await invoke('messages:move', ids, 'archive'); useUi.getState().toast({ text: 'Archivé', ttl: 1500 }) } catch (e: any) { useUi.getState().toast({ text: String(e?.message ?? e).replace(/^Error invoking remote method '[^']+': Error: /, ''), ttl: 6000 }) }
  },
  trash: async (threadId) => {
    // déjà dans la corbeille (ou indésirables) : suppression définitive
    const th = get().threads.find((x) => x.id === threadId) ?? get().current?.thread
    const { useAccounts } = await import('./accounts.store')
    const fs = th ? (useAccounts.getState().folders[th.accountId] ?? []) : []
    if (th && th.folderIds.length && th.folderIds.every((id) => { const r = fs.find((f) => f.id === id)?.role; return r === 'trash' || r === 'spam' })) return get().deleteForever(threadId)
    const t = get().current
    const ids = t && t.thread.id === threadId ? t.messages.map((m) => m.id) : (await invoke('threads:get', threadId)).messages.map((m) => m.id)
    get().selectRelative(1)
    get().removeLocal(threadId)
    try { await invoke('messages:move', ids, 'trash') } catch (e: any) { useUi.getState().toast({ text: String(e?.message ?? e).replace(/^Error invoking remote method '[^']+': Error: /, ''), ttl: 6000 }) }
  },
  selectRelative: (delta) => {
    const { threads, selectedId } = get()
    const i = threads.findIndex((t) => t.id === selectedId)
    const next = threads[Math.min(Math.max(i + delta, 0), threads.length - 1)]
    if (next && next.id !== selectedId) void get().select(next.id)
  }
}))