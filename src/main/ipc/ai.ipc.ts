// src/main/ipc/ai.ipc.ts
import { handle } from './index'
import { SettingsRepo } from '../db/repositories/SettingsRepo'
import { Credentials } from '../auth/Credentials'
import { AiService, extractEvent } from '../ai/AiService'
import { Classifier } from '../ai/Classifier'
import { getDb, j, p } from '../db'

export function registerAiIpc(): void {
  handle('ai:settings:get', () => {
    const s = SettingsRepo.ai()
    return { ...s, provider: { ...s.provider, hasKey: s.provider.kind === 'ollama' ? true : !!Credentials.getAiKey(s.provider.kind) } }
  })
  handle('ai:settings:set', (patch) => {
    const before = SettingsRepo.ai().autoClassify
    const s = SettingsRepo.setAi(patch)
    if (!before && s.autoClassify) {
      const ids = getDb().prepare(`SELECT m.id FROM messages m JOIN folders f ON f.id = m.folder_id WHERE f.role = 'inbox' AND m.category IS NULL ORDER BY m.date DESC LIMIT 40`).all().map((r: any) => r.id)
      Classifier.enqueueMany(ids)
    }
    return s
  })
  handle('ai:setKey', (kind, key) => Credentials.setAiKey(kind, key))
  handle('ai:models', () => AiService.models())
  handle('ai:healthcheck', () => AiService.healthcheck())
  handle('ai:run', (input, streamId) => AiService.run(input, streamId))
  handle('ai:cancel', (streamId) => AiService.cancel(streamId))
  handle('ai:extractEvent', (messageId) => extractEvent(messageId))
  handle('chats:list', () => getDb().prepare('SELECT id, title, pinned, updated_at FROM chats ORDER BY pinned DESC, updated_at DESC LIMIT 100').all().map((r: any) => ({ id: r.id, title: r.title, pinned: !!r.pinned, updatedAt: r.updated_at })))
  handle('chats:get', (id) => { const r = getDb().prepare('SELECT * FROM chats WHERE id = ?').get(id) as any; return r ? { id: r.id, title: r.title, turns: p<unknown[]>(r.turns_json, []), pinned: !!r.pinned, updatedAt: r.updated_at } : null })
  handle('chats:save', (c) => { getDb().prepare('INSERT INTO chats(id,title,turns_json,pinned,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, turns_json=excluded.turns_json, updated_at=excluded.updated_at').run(c.id, c.title.slice(0, 120), j(c.turns), c.pinned ? 1 : 0, Date.now()) })
  handle('chats:delete', (id) => { getDb().prepare('DELETE FROM chats WHERE id = ?').run(id) })
  handle('chats:pin', (id, pinned) => { getDb().prepare('UPDATE chats SET pinned = ? WHERE id = ?').run(pinned ? 1 : 0, id) })
}