// src/main/env.ts — en développement, charge le .env du projet dans process.env (en production, les valeurs sont incorporées au build)
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

export function loadDevEnv(): void {
  if (app.isPackaged) return
  for (const dir of [process.cwd(), join(__dirname, '..', '..')]) {
    const p = join(dir, '.env')
    if (!existsSync(p)) continue
    for (const raw of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const line = raw.replace(/^\uFEFF/, '').trim()
      if (!line || line.startsWith('#')) continue
      const i = line.indexOf('='); if (i < 1) continue
      const k = line.slice(0, i).trim(); const v = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[k]) process.env[k] = v
    }
    return
  }
}