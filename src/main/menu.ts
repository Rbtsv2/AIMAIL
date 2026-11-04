import { Menu, app, type MenuItemConstructorOptions } from 'electron'
import { getWindow } from './window'

const send = (channel: string) => () => getWindow()?.webContents.send('menu', channel)

export function buildMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ label: app.name, submenu: [{ role: 'about' as const }, { type: 'separator' as const }, { label: 'Réglages…', accelerator: 'Cmd+,', click: send('settings') }, { type: 'separator' as const }, { role: 'hide' as const }, { role: 'quit' as const }] }] : []),
    { label: 'Fichier', submenu: [
      { label: 'Nouveau message', accelerator: 'CmdOrCtrl+N', click: send('compose') },
      { label: 'Synchroniser', accelerator: 'CmdOrCtrl+Shift+R', click: send('sync') },
      ...(isMac ? [] : [{ type: 'separator' as const }, { label: 'Réglages', accelerator: 'Ctrl+,', click: send('settings') }, { role: 'quit' as const }])
    ] },
    { label: 'Édition', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'Présentation', submenu: [{ label: 'Rechercher', accelerator: 'CmdOrCtrl+K', click: send('palette') }, { type: 'separator' }, { role: 'togglefullscreen' }, { role: 'toggleDevTools' }] },
    { label: 'Fenêtre', submenu: [{ role: 'minimize' }, { role: 'close' }] }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
