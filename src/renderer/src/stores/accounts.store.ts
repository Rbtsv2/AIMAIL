// src/renderer/src/stores/accounts.store.ts
import { create } from 'zustand'
import type { Account, AccountInput } from '@shared/models/Account'
import type { Folder } from '@shared/models/Folder'
import type { SyncStatus } from '@shared/ipc'
import { invoke } from '@/lib/api'
import { setOwnNames } from '@/lib/text'

interface S {
  accounts: Account[]
  folders: Record<string, Folder[]>
  status: Record<string, SyncStatus>
  loaded: boolean
  load(): Promise<void>
  loadFolders(accountId?: string): Promise<void>
  add(input: AccountInput): Promise<Account>
  update(id: string, patch: Partial<Account>): Promise<void>
  remove(id: string): Promise<void>
  setStatus(s: SyncStatus): void
}

const useMail_refresh = async () => { const m = await import('./mail.store'); await m.useMail.getState().refresh(); await m.useMail.getState().reloadCurrent() }

export const useAccounts = create<S>((set, get) => ({
  accounts: [], folders: {}, status: {}, loaded: false,
  load: async () => {
    const accounts = await invoke('accounts:list')
    const st = await invoke('sync:status')
    setOwnNames(accounts)
    set({ accounts, loaded: true, status: Object.fromEntries(st.map((s) => [s.accountId, s])) })
    await get().loadFolders()
  },
  loadFolders: async (accountId) => {
    const ids = accountId ? [accountId] : get().accounts.map((a) => a.id)
    const entries = await Promise.all(ids.map(async (id) => [id, await invoke('folders:list', id)] as const))
    set((s) => ({ folders: { ...s.folders, ...Object.fromEntries(entries) } }))
  },
  add: async (input) => { const a = await invoke('accounts:add', input); set((s) => ({ accounts: [...s.accounts, a] })); setOwnNames(get().accounts); return a },
  update: async (id, patch) => { const a = await invoke('accounts:update', id, patch); set((s) => ({ accounts: s.accounts.map((x) => (x.id === id ? a : x)) })); setOwnNames(get().accounts); void useMail_refresh() },
  remove: async (id) => { await invoke('accounts:remove', id); set((s) => ({ accounts: s.accounts.filter((x) => x.id !== id) })) },
  setStatus: (st) => set((s) => ({ status: { ...s.status, [st.accountId]: st } }))
}))