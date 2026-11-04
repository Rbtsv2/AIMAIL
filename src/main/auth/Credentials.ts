import { safeStorage, app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import type { AccountCredentials } from '@shared/models/Account'

const file = () => join(app.getPath('userData'), 'secrets.bin')

function loadAll(): Record<string, string> {
  if (!existsSync(file())) return {}
  const buf = readFileSync(file())
  const raw = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : buf.toString('utf8')
  try { return JSON.parse(raw) } catch { return {} }
}

function saveAll(data: Record<string, string>): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  const raw = JSON.stringify(data)
  const buf = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(raw) : Buffer.from(raw, 'utf8')
  writeFileSync(file(), buf)
}

export const Credentials = {
  set(key: string, value: string): void {
    const all = loadAll(); all[key] = value; saveAll(all)
  },
  get(key: string): string | undefined {
    return loadAll()[key]
  },
  remove(key: string): void {
    const all = loadAll(); delete all[key]; saveAll(all)
  },
  setAccount(accountId: string, c: AccountCredentials): void {
    this.set(`account:${accountId}`, JSON.stringify(c))
  },
  getAccount(accountId: string): AccountCredentials {
    const v = this.get(`account:${accountId}`)
    return v ? JSON.parse(v) : {}
  },
  setAiKey(kind: string, key: string): void { this.set(`ai:${kind}`, key) },
  getAiKey(kind: string): string | undefined { return this.get(`ai:${kind}`) }
}
