// src/renderer/src/stores/muted.store.ts — expéditeurs exclus des réponses préparées
import { create } from 'zustand'
import { invoke } from '@/lib/api'

interface S {
  addresses: Set<string>
  load(): Promise<void>
  toggle(address: string): Promise<boolean>
  is(address: string): boolean
}

export const useMuted = create<S>((set, get) => ({
  addresses: new Set(),
  load: async () => set({ addresses: new Set((await invoke('muted:list')).map((m) => m.address)) }),
  toggle: async (address) => { const on = await invoke('muted:toggle', address); await get().load(); return on },
  is: (address) => get().addresses.has(address.toLowerCase())
}))