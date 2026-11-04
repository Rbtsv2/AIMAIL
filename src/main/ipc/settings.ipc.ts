// src/main/ipc/settings.ipc.ts
import { nativeTheme } from 'electron'
import { handle } from './index'
import { Updater } from '../Updater'
import { SettingsRepo } from '../db/repositories/SettingsRepo'

export function registerSettingsIpc(): void {
  handle('update:state', () => Updater.state())
  handle('update:check', () => Updater.check())
  handle('update:install', () => Updater.install())
  handle('settings:get', () => SettingsRepo.app())
  handle('settings:set', (patch) => {
    const s = SettingsRepo.setApp(patch)
    nativeTheme.themeSource = s.theme
    return s
  })
  handle('signatures:list', () => SettingsRepo.signatures())
  handle('signatures:save', (s) => SettingsRepo.saveSignature(s))
  handle('signatures:delete', (id) => SettingsRepo.deleteSignature(id))
}