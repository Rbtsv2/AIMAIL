// src/main/window.ts
import { BrowserWindow, shell, nativeTheme } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let win: BrowserWindow | null = null

export function createWindow(): BrowserWindow {
  const isMac = process.platform === 'darwin'
  const isLinux = process.platform === 'linux'
  const dark = nativeTheme.shouldUseDarkColors

  win = new BrowserWindow({
    title: 'AIMAIL',
    width: 1280, height: 820, minWidth: 900, minHeight: 600,
    show: false,
    frame: false,
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    titleBarOverlay: isMac ? undefined : { color: dark ? '#1c1c1e' : '#f5f5f7', symbolColor: dark ? '#98989d' : '#6e6e73', height: 44 },
    trafficLightPosition: { x: 16, y: 14 },
    vibrancy: isMac ? 'sidebar' : undefined,
    visualEffectState: 'active',
    transparent: process.platform === 'win32',
    backgroundColor: isLinux ? (dark ? '#1c1c1e' : '#f5f5f7') : '#00000000',
    hasShadow: true,
    autoHideMenuBar: true,
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false, contextIsolation: true, nodeIntegration: false, spellcheck: true
    }
  })
  win.on('ready-to-show', () => win?.show())
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:') && !url.startsWith('http://localhost')) { e.preventDefault(); shell.openExternal(url) } })
  if (is.dev && process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
  win.on('closed', () => { win = null })
  return win
}

export function createComposeWindow(draftId: string): BrowserWindow {
  const isMac = process.platform === 'darwin'
  const isLinux = process.platform === 'linux'
  const dark = nativeTheme.shouldUseDarkColors
  const w = new BrowserWindow({
    width: 780, height: 640, minWidth: 560, minHeight: 420,
    show: false,
    frame: false,
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    titleBarOverlay: isMac ? undefined : { color: dark ? '#1c1c1e' : '#f5f5f7', symbolColor: dark ? '#98989d' : '#6e6e73', height: 44 },
    trafficLightPosition: { x: 16, y: 14 },
    transparent: process.platform === 'win32',
    backgroundColor: isLinux ? (dark ? '#1c1c1e' : '#f5f5f7') : '#00000000',
    autoHideMenuBar: true,
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false, contextIsolation: true, nodeIntegration: false, spellcheck: true }
  })
  w.on('ready-to-show', () => w.show())
  w.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })
  const hash = `#compose=${draftId}`
  if (is.dev && process.env.ELECTRON_RENDERER_URL) w.loadURL(process.env.ELECTRON_RENDERER_URL + hash)
  else w.loadFile(join(__dirname, '../renderer/index.html'), { hash: hash.slice(1) })
  return w
}

export const getWindow = (): BrowserWindow | null => win