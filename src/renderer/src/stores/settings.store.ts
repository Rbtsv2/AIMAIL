import { create } from 'zustand'
import type { AppSettings } from '@shared/ipc'
import type { Signature } from '@shared/models/Signature'
import { invoke } from '@/lib/api'

interface S {
  app: AppSettings | null
  signatures: Signature[]
  load(): Promise<void>
  setApp(patch: Partial<AppSettings>): Promise<void>
  saveSignature(s: Signature): Promise<void>
  deleteSignature(id: string): Promise<void>
}

export const useSettings = create<S>((set) => ({
  app: null, signatures: [],
  load: async () => set({ app: await invoke('settings:get'), signatures: await invoke('signatures:list') }),
  setApp: async (patch) => set({ app: await invoke('settings:set', patch) }),
  saveSignature: async (s) => { await invoke('signatures:save', s); set({ signatures: await invoke('signatures:list') }) },
  deleteSignature: async (id) => { await invoke('signatures:delete', id); set({ signatures: await invoke('signatures:list') }) }
}))
