// src/main/db/repositories/SourceRepo.ts
import { getDb, id, j, p } from '../index'
import type { Source, SourceInput } from '@shared/models/Source'
import { Credentials } from '../../auth/Credentials'

function row(r: any): Source {
  return {
    id: r.id, accountIds: p<string[]>(r.account_ids_json, []), kind: r.kind, name: r.name, description: r.description, urls: p<string[]>(r.urls_json, []), method: r.method,
    bodyTemplate: r.body_template, authKind: r.auth_kind, filePath: r.file_path, enabled: !!r.enabled,
    cachedText: r.cached_text, cachedAt: r.cached_at, hasSecret: !!Credentials.get(`source:${r.id}`), createdAt: r.created_at
  }
}

export const SourceRepo = {
  list(accountId?: string): Source[] {
    const rows = getDb().prepare('SELECT * FROM sources ORDER BY name').all().map(row)
    return accountId ? rows.filter((s) => s.accountIds.includes(accountId)) : rows
  },
  get(sourceId: string): Source | undefined {
    const r = getDb().prepare('SELECT * FROM sources WHERE id = ?').get(sourceId)
    return r ? row(r) : undefined
  },
  save(input: SourceInput): Source {
    const sid = input.id || id()
    const urls = (input.urls ?? []).map((u) => u.trim()).filter(Boolean)
    getDb().prepare(`INSERT INTO sources(id,account_id,account_ids_json,kind,name,description,url,urls_json,method,body_template,auth_kind,file_path,enabled,created_at)
      VALUES (@id,@account_id,@account_ids,@kind,@name,@description,@url,@urls,@method,@body_template,@auth_kind,@file_path,@enabled,@created_at)
      ON CONFLICT(id) DO UPDATE SET account_id=excluded.account_id, account_ids_json=excluded.account_ids_json, kind=excluded.kind, name=excluded.name, description=excluded.description, url=excluded.url, urls_json=excluded.urls_json,
        method=excluded.method, body_template=excluded.body_template, auth_kind=excluded.auth_kind, file_path=excluded.file_path, enabled=excluded.enabled`).run({
      id: sid, account_id: input.accountIds?.[0] ?? null, account_ids: j(input.accountIds ?? []), kind: input.kind, name: input.name.trim(), description: input.description.trim(), url: urls[0] ?? '', urls: j(urls),
      method: input.method, body_template: input.bodyTemplate, auth_kind: input.authKind, file_path: input.filePath, enabled: input.enabled ? 1 : 0, created_at: Date.now()
    })
    if (input.secret && Object.values(input.secret).some((v) => v)) Credentials.set(`source:${sid}`, JSON.stringify(input.secret))
    return this.get(sid)!
  },
  setCache(sourceId: string, text: string | null): void {
    getDb().prepare('UPDATE sources SET cached_text=?, cached_at=? WHERE id=?').run(text, text ? Date.now() : null, sourceId)
  },
  remove(sourceId: string): void {
    getDb().prepare('DELETE FROM sources WHERE id = ?').run(sourceId)
    Credentials.remove(`source:${sourceId}`)
  }
}