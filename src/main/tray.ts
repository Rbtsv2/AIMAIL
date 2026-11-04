import { Tray, Menu, nativeImage, app } from 'electron'
import { join } from 'path'
import { getWindow, createWindow } from './window'

let tray: Tray | null = null

export function createTray(): void {
  const icon = nativeImage.createFromPath(join(__dirname, '../../resources/tray/trayTemplate.png'))
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip('Mail')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Ouvrir Mail', click: () => (getWindow() ?? createWindow()).show() },
    { type: 'separator' },
    { label: 'Quitter', click: () => app.quit() }
  ]))
  tray.on('click', () => (getWindow() ?? createWindow()).show())
}
