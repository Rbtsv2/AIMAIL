import { nativeTheme } from 'electron'
import { handle } from './index'
import { SettingsRepo } from '../db/repositories/SettingsRepo'

export function registerSettingsIpc(): void {
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
