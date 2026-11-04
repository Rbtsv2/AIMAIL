// src/main/ipc/window.ipc.ts
import { ipcMain, screen, BrowserWindow } from 'electron'

let timer: NodeJS.Timeout | null = null

export function registerWindowIpc(): void {
  ipcMain.on('window:dragStart', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    const start = screen.getCursorScreenPoint()
    const [wx, wy] = win.getPosition()
    if (timer) clearInterval(timer)
    timer = setInterval(() => {
      const p = screen.getCursorScreenPoint()
      win.setPosition(wx + p.x - start.x, wy + p.y - start.y)
    }, 16)
  })
  ipcMain.on('window:dragEnd', () => { if (timer) { clearInterval(timer); timer = null } })
  ipcMain.on('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
  ipcMain.on('window:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close())
  ipcMain.handle('window:isMaximized', (e) => BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false)
  ipcMain.on('window:toggleMaximize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize(); else win.maximize()
  })
}