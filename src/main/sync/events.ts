import { EventEmitter } from 'events'
import type { IpcEvents } from '@shared/ipc'

class TypedEmitter extends EventEmitter {
  emitEvent<K extends keyof IpcEvents>(k: K, payload: IpcEvents[K]): void { this.emit(k, payload) }
  onEvent<K extends keyof IpcEvents>(k: K, fn: (p: IpcEvents[K]) => void): () => void {
    this.on(k, fn); return () => this.off(k, fn)
  }
}
export const events = new TypedEmitter()
