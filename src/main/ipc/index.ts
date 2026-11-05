// src/main/ipc/index.ts
import { ipcMain, BrowserWindow } from 'electron'
import type { IpcInvoke, IpcEvents } from '@shared/ipc'
import { events } from '../sync/events'
import { registerAccountsIpc } from './accounts.ipc'
import { registerMailIpc } from './mail.ipc'
import { registerComposeIpc } from './compose.ipc'
import { registerAiIpc } from './ai.ipc'
import { registerRepliesIpc } from './replies.ipc'
import { registerRulesIpc } from './rules.ipc'
import { registerSettingsIpc } from './settings.ipc'
import { registerWindowIpc } from './window.ipc'
import { registerSourcesIpc } from './sources.ipc'
import { registerContactsIpc } from './contacts.ipc'
import { registerCalendarIpc } from './calendar.ipc'
import { registerBackupIpc } from './backup.ipc'

export function handle<K extends keyof IpcInvoke>(channel: K, fn: (...args: Parameters<IpcInvoke[K]>) => ReturnType<IpcInvoke[K]> | Promise<ReturnType<IpcInvoke[K]>>): void {
  ipcMain.handle(channel, (_e, ...args) => fn(...(args as Parameters<IpcInvoke[K]>)))
}

export function registerIpc(): void {
  registerAccountsIpc(); registerMailIpc(); registerComposeIpc(); registerAiIpc(); registerRepliesIpc(); registerRulesIpc(); registerSettingsIpc(); registerWindowIpc(); registerSourcesIpc(); registerContactsIpc(); registerCalendarIpc(); registerBackupIpc()
  ipcMain.on('window:closeSelf', (e) => BrowserWindow.fromWebContents(e.sender)?.close())
  const forward = <K extends keyof IpcEvents>(k: K) => events.onEvent(k, (p) => {
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send(k, p)
  })
  forward('sync:status'); forward('mail:changed'); forward('outbox:changed')
  forward('ai:token'); forward('ai:done'); forward('ai:error'); forward('ai:tool'); forward('ai:refs'); forward('calendar:changed'); forward('notify'); forward('update:state'); forward('replies:changed')
}