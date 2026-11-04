// src/main/Updater.ts
// Mises à jour automatiques via les Releases GitHub (electron-updater) : vérification au démarrage puis toutes les 6 h,
// téléchargement en arrière-plan, installation au redémarrage (ou à la fermeture). Inactif en développement.
import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { events } from './sync/events'
import { log } from './utils/logger'
import { SettingsRepo } from './db/repositories/SettingsRepo'
import type { UpdateState } from '@shared/ipc'

let state: UpdateState = { status: 'idle', current: app.getVersion() }
let timer: NodeJS.Timeout | null = null

function set(patch: Partial<UpdateState>): void {
  state = { ...state, ...patch, current: app.getVersion() }
  events.emitEvent('update:state', state)
}

export const Updater = {
  state: (): UpdateState => state,

  start(): void {
    if (!app.isPackaged || process.env.AIMAIL_NO_UPDATE === '1') { set({ status: 'disabled' }); return }
    autoUpdater.logger = { info: (m: unknown) => log.info('update', m), warn: (m: unknown) => log.warn('update', m), error: (m: unknown) => log.error('update', m), debug: () => {} } as any
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowPrerelease = false
    autoUpdater.on('checking-for-update', () => set({ status: 'checking' }))
    autoUpdater.on('update-available', (i) => set({ status: 'downloading', version: i.version, notes: typeof i.releaseNotes === 'string' ? i.releaseNotes : undefined, progress: 0 }))
    autoUpdater.on('update-not-available', () => set({ status: 'up-to-date', checkedAt: Date.now() }))
    autoUpdater.on('download-progress', (p) => set({ status: 'downloading', progress: Math.round(p.percent) }))
    autoUpdater.on('update-downloaded', (i) => { set({ status: 'ready', version: i.version, progress: 100 }); log.info('update', `version ${i.version} prête à installer`) })
    autoUpdater.on('error', (e) => { set({ status: 'error', error: e?.message ?? String(e) }); log.warn('update', e?.message ?? e) })
    if (SettingsRepo.app().autoUpdate !== false) {
      setTimeout(() => void this.check(), 20_000)
      timer = setInterval(() => void this.check(), 6 * 3600_000)
    } else set({ status: 'idle' })
  },

  async check(): Promise<UpdateState> {
    if (!app.isPackaged) return state
    try { await autoUpdater.checkForUpdates() } catch (e: any) { set({ status: 'error', error: e?.message ?? String(e) }) }
    return state
  },

  install(): void {
    if (state.status !== 'ready') return
    setImmediate(() => autoUpdater.quitAndInstall(false, true))
  },

  stop(): void { if (timer) clearInterval(timer) }
}