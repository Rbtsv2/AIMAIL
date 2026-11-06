// src/main/utils/logger.ts
// Journal console + fichier (userData/logs/aimail.log, rotation à 5 Mo) pour diagnostiquer une version installée.
import { app } from 'electron'
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'fs'
import { join } from 'path'

const ts = () => new Date().toISOString().slice(11, 23)
let logFile: string | null = null

function file(): string | null {
  if (logFile) return logFile
  try {
    const dir = join(app.getPath('userData'), 'logs')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    logFile = join(dir, 'aimail.log')
    if (existsSync(logFile) && statSync(logFile).size > 5 * 1024 * 1024) renameSync(logFile, join(dir, 'aimail.old.log'))
    return logFile
  } catch { return null }
}

function write(level: string, scope: string, a: unknown[]): void {
  const f = file()
  if (!f) return
  try { appendFileSync(f, `${new Date().toISOString()} ${level} [${scope}] ${a.map((x) => (x instanceof Error ? x.stack ?? x.message : typeof x === 'string' ? x : JSON.stringify(x))).join(' ')}\n`) } catch {}
}

export const log = {
  info: (scope: string, ...a: unknown[]) => { console.log(`[${ts()}] [${scope}]`, ...a); write('INFO', scope, a) },
  warn: (scope: string, ...a: unknown[]) => { console.warn(`[${ts()}] [${scope}]`, ...a); write('WARN', scope, a) },
  error: (scope: string, ...a: unknown[]) => { console.error(`[${ts()}] [${scope}]`, ...a); write('ERROR', scope, a) },
  path: (): string | null => file()
}