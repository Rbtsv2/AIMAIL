// src/renderer/src/stores/ai.store.ts
import { create } from 'zustand'
import type { AiSettings } from '@shared/ai/AiSettings'
import type { AiTask } from '@shared/ai/AiTask'
import type { AiModelInfo, AiRunInput } from '@shared/ipc'
import { invoke } from '@/lib/api'

interface S {
  settings: AiSettings | null
  models: AiModelInfo[]
  healthy: boolean | null
  task: AiTask | null
  streamId: string | null
  output: string
  streaming: boolean
  error: string | null
  tool: string | null
  resetOnToken: boolean
  load(): Promise<void>
  save(patch: Partial<AiSettings>): Promise<void>
  setKey(kind: string, key: string): Promise<void>
  refreshModels(): Promise<void>
  run(input: AiRunInput): Promise<void>
  cancel(): Promise<void>
  clear(): void
  onToken(streamId: string, token: string): void
  onTool(streamId: string, label: string): void
  streamIdOf(): string | null
  setOutput(text: string): void
  onDone(streamId: string, text: string): void
  onError(streamId: string, error: string): void
}

export const useAi = create<S>((set, get) => ({
  settings: null, models: [], healthy: null, task: null, streamId: null, output: '', streaming: false, error: null, tool: null, resetOnToken: false,
  load: async () => { set({ settings: await invoke('ai:settings:get') }); void get().refreshModels() },
  save: async (patch) => { await invoke('ai:settings:set', patch); set({ settings: await invoke('ai:settings:get') }); void get().refreshModels() },
  setKey: async (kind, key) => { await invoke('ai:setKey', kind, key); set({ settings: await invoke('ai:settings:get') }); void get().refreshModels() },
  refreshModels: async () => {
    try { const healthy = await invoke('ai:healthcheck'); set({ healthy, models: healthy ? await invoke('ai:models') : [] }) }
    catch { set({ healthy: false, models: [] }) }
  },
  run: async (input) => {
    const streamId = crypto.randomUUID()
    set({ task: input.task, streamId, output: '', streaming: true, error: null, tool: null })
    try { await invoke('ai:run', input, streamId) } catch (e: any) { if (!get().error) set({ streaming: false, error: String(e?.message ?? e).replace(/^Error invoking remote method 'ai:run': Error: /, '') }) }
  },
  cancel: async () => { const id = get().streamId; if (id) await invoke('ai:cancel', id); set({ streaming: false }) },
  clear: () => set({ task: null, streamId: null, output: '', streaming: false, error: null }),
  onToken: (streamId, token) => { if (streamId === get().streamId) set((s) => ({ output: s.resetOnToken ? token : s.output + token, tool: null, resetOnToken: false })) },
  streamIdOf: () => get().streamId,
  onTool: (streamId, label) => { if (streamId === get().streamId) set({ tool: label, resetOnToken: !/vérification|rédaction|complète|lecture de votre|trouvé|élargis/i.test(label) }) },
  onDone: (streamId, text) => { if (streamId === get().streamId) set({ output: text, streaming: false, tool: null, resetOnToken: false }) },
  setOutput: (text) => set({ output: text }),
  onError: (streamId, error) => { if (streamId === get().streamId) set({ streaming: false, error }) }
}))