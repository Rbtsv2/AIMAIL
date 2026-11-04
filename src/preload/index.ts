// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'
import type { IpcInvoke, IpcEvents } from '@shared/ipc'

type Invoke = <K extends keyof IpcInvoke>(channel: K, ...args: Parameters<IpcInvoke[K]>) => Promise<ReturnType<IpcInvoke[K]>>
type On = <K extends keyof IpcEvents>(channel: K, fn: (payload: IpcEvents[K]) => void) => () => void

const invoke: Invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args)
const on: On = (channel, fn) => {
  const h = (_: unknown, p: any) => fn(p)
  ipcRenderer.on(channel, h)
  return () => ipcRenderer.off(channel, h)
}
const onMenu = (fn: (action: string) => void) => {
  const h = (_: unknown, a: string) => fn(a)
  ipcRenderer.on('menu', h)
  return () => ipcRenderer.off('menu', h)
}
const onOpenThread = (fn: (threadId: string) => void) => {
  const h = (_: unknown, t: string) => fn(t)
  ipcRenderer.on('open-thread', h)
  return () => ipcRenderer.off('open-thread', h)
}
const dragStart = () => ipcRenderer.send('window:dragStart')
const dragEnd = () => ipcRenderer.send('window:dragEnd')
const toggleMaximize = () => ipcRenderer.send('window:toggleMaximize')
const minimize = () => ipcRenderer.send('window:minimize')
const closeWindow = () => ipcRenderer.send('window:close')
const closeSelf = () => ipcRenderer.send('window:closeSelf')
const isMaximized = (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized')

export const api = { customControls: false, invoke, on, onMenu, onOpenThread, dragStart, dragEnd, toggleMaximize, minimize, closeWindow, closeSelf, isMaximized, platform: process.platform }
contextBridge.exposeInMainWorld('api', api)