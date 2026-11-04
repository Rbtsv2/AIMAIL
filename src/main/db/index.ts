import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { readdirSync, readFileSync, existsSync } from 'fs'
import { log } from '../utils/logger'

let db: Database.Database | null = null

function migrationsDir(): string {
  const dev = join(__dirname, '../../src/main/db/migrations')
  if (existsSync(dev)) return dev
  return join(process.resourcesPath, 'migrations')
}

export function getDb(): Database.Database {
  if (db) return db
  const file = join(app.getPath('userData'), 'mail.db')
  db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')
  db.exec('CREATE TABLE IF NOT EXISTS _migrations(name TEXT PRIMARY KEY)')
  const applied = new Set(db.prepare('SELECT name FROM _migrations').all().map((r: any) => r.name))
  const dir = migrationsDir()
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (applied.has(f)) continue
    db.exec(readFileSync(join(dir, f), 'utf8'))
    db.prepare('INSERT INTO _migrations(name) VALUES (?)').run(f)
    log.info('db', 'migration', f)
  }
  return db
}

export function closeDb(): void {
  db?.close()
  db = null
}

export const j = (v: unknown): string => JSON.stringify(v ?? null)
export const p = <T>(s: string | null, fallback: T): T => {
  if (!s) return fallback
  try { return JSON.parse(s) as T } catch { return fallback }
}
export const id = (): string => crypto.randomUUID()
