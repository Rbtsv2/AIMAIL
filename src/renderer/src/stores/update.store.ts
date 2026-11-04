// src/renderer/src/stores/update.store.ts
import { create } from 'zustand'
import type { UpdateState } from '@shared/ipc'
import { invoke } from '@/lib/api'

interface S {
  state: UpdateState
  set(s: UpdateState): void
  load(): Promise<void>
  check(): Promise<void>
  install(): Promise<void>
}

export const useUpdate = create<S>((set) => ({
  state: { status: 'idle', current: '' },
  set: (state) => set({ state }),
  load: async () => set({ state: await invoke('update:state') }),
  check: async () => set({ state: await invoke('update:check') }),
  install: async () => { await invoke('update:install') }
}))