// src/main/index.ts
import { loadDevEnv } from './env'
import { powerMonitor } from 'electron'
import { app, BrowserWindow, dialog, Notification, nativeTheme } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createWindow, getWindow } from './window'
import { createTray } from './tray'
import { buildMenu } from './menu'
import { registerIpc } from './ipc'
import { getDb, closeDb } from './db'
import { SettingsRepo } from './db/repositories/SettingsRepo'
import { SyncManager } from './sync/SyncManager'
import { events } from './sync/events'
import { APP_PROTOCOL } from '@shared/constants'
import { CalendarService } from './calendar/CalendarService'
import { ContactRepo } from './db/repositories/ContactRepo'
import { AccountRepo } from './db/repositories/AccountRepo'
import { log } from './utils/logger'
import { OllamaProvider } from './ai/providers/OllamaProvider'
import { Indexer } from './sync/Indexer'
import { Janitor } from './sync/Janitor'
import { Updater } from './Updater'

if (process.platform === 'linux') {
  // hérité par le processus GPU : coupe les messages de diagnostic Mesa (« GBM-DRV error »)
  process.env.MESA_DEBUG ??= 'silent'
  process.env.LIBGL_DEBUG ??= 'quiet'
  process.env.EGL_LOG_LEVEL ??= 'fatal'
  app.commandLine.appendSwitch('ozone-platform', 'x11')
  if (process.env.MAIL_GPU !== '1') {
    app.disableHardwareAcceleration()
    app.commandLine.appendSwitch('disable-gpu')
    app.commandLine.appendSwitch('disable-gpu-compositing')
    // évite le sondage des formats GBM/DMA-BUF par Mesa (messages « GBM-DRV error » dans le terminal)
    app.commandLine.appendSwitch('disable-features', 'UseChromeOSDirectVideoDecoder,VaapiVideoDecoder,VaapiVideoEncoder,UseDmaBufForVideoFrames')
    app.commandLine.appendSwitch('use-gl', 'disabled')
  }
}

if (!app.requestSingleInstanceLock()) app.quit()

// en développement, l'enregistrement du protocole passe par xdg-mime (bruyant, inutile) : seulement en version installée
if (app.isPackaged) app.setAsDefaultProtocolClient(APP_PROTOCOL)

// erreur fatale au démarrage : journal + boîte de dialogue au lieu d'une fermeture silencieuse
function fatal(where: string, e: unknown): void {
  const msg = e instanceof Error ? `${e.message}\n\n${e.stack ?? ''}` : String(e)
  log.error('fatal', where, e)
  try { dialog.showErrorBox(`AIMAIL ne peut pas démarrer (${where})`, `${msg}\n\nJournal : ${log.path() ?? '—'}`) } catch {}
  app.exit(1)
}
process.on('uncaughtException', (e) => { if (!app.isReady()) fatal('uncaughtException', e); else log.error('uncaught', e) })
process.on('unhandledRejection', (e) => log.error('unhandledRejection', e))

loadDevEnv()
app.whenReady().then(async () => {
  try {
  electronApp.setAppUserModelId('com.chilloutnetworks.aimail')
  app.on('browser-window-created', (_, w) => optimizer.watchWindowShortcuts(w))
  getDb()
  nativeTheme.themeSource = SettingsRepo.app().theme
  nativeTheme.on('updated', () => { for (const w of BrowserWindow.getAllWindows()) { try { w.setTitleBarOverlay?.({ color: nativeTheme.shouldUseDarkColors ? '#1c1c1e' : '#f5f5f7', symbolColor: nativeTheme.shouldUseDarkColors ? '#98989d' : '#6e6e73', height: 44 }) } catch {} } })
  registerIpc()
  buildMenu()
  createWindow()
  createTray()
  await SyncManager.start()
  // veille / réveil / verrouillage : connexions à refaire
  powerMonitor.on('resume', () => void SyncManager.reconnectAll('réveil'))
  powerMonitor.on('unlock-screen', () => void SyncManager.reconnectAll('déverrouillage'))
  // veille non signalée (horloge qui saute) : reconnexion si le processus n'a pas tourné pendant plus de 3 min
  let lastTick = Date.now()
  setInterval(() => { const now = Date.now(); if (now - lastTick > 3 * 60_000) void SyncManager.reconnectAll('reprise après inactivité'); lastTick = now }, 30_000)
  setTimeout(() => void CalendarService.sync(), 8000)
  setTimeout(() => void Indexer.runOnce(), 15000)
  setInterval(() => void Indexer.runOnce(), 3 * 60_000)
  Updater.start()
  setTimeout(() => void Janitor.runOnce(), 90_000)
  setInterval(() => void Janitor.runOnce(), 6 * 3600_000)
  setTimeout(() => { const ai = SettingsRepo.ai(); if (ai.enabled && ai.provider.kind === 'ollama') void new OllamaProvider(ai.provider.baseUrl).warm(ai.provider.model) }, 3000)
  setTimeout(() => { if (SettingsRepo.app().collectAddresses !== false) { try { const n = ContactRepo.harvestAll(new Set(AccountRepo.list().map((a) => a.email.toLowerCase()))); if (n) log.info('contacts', `${n} adresses collectées`) } catch (e: any) { log.warn('contacts', e?.message) } } }, 20000)
  setInterval(() => void CalendarService.sync(), 15 * 60_000)

  events.onEvent('notify', (n) => {
    if (!Notification.isSupported()) return
    const notif = new Notification({ title: n.title, body: n.body, silent: false })
    notif.on('click', () => { getWindow()?.show(); getWindow()?.webContents.send('open-thread', n.threadId) })
    notif.show()
  })

  app.on('second-instance', () => { const w = getWindow(); if (w) { if (w.isMinimized()) w.restore(); w.focus() } })
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
  } catch (e) { fatal('démarrage', e) }
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('before-quit', async () => { await SyncManager.stopAll(); closeDb() })