// src/main/ai/SourceService.ts
import { readFileSync } from 'fs'
import { extname } from 'path'
import { convert } from 'html-to-text'
import type { Source, SourceSecret } from '@shared/models/Source'
import { SourceRepo } from '../db/repositories/SourceRepo'
import { Credentials } from '../auth/Credentials'
import { log } from '../utils/logger'

const MAX_CHARS = 8000
const INLINE_MAX = 3000

const secretOf = (s: Source): SourceSecret => { const v = Credentials.get(`source:${s.id}`); return v ? JSON.parse(v) : {} }

function htmlToText(html: string): string {
  return convert(html, { wordwrap: false, selectors: [{ selector: 'a', options: { ignoreHref: true } }, { selector: 'img', format: 'skip' }, { selector: 'script', format: 'skip' }, { selector: 'style', format: 'skip' }, { selector: 'nav', format: 'skip' }] })
}
const clean = (t: string, max = MAX_CHARS) => t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max)

async function readFile(path: string): Promise<string> {
  const ext = extname(path).toLowerCase()
  if (ext === '.pdf') { const pdf = (await import('pdf-parse')).default; return (await pdf(readFileSync(path))).text }
  if (ext === '.docx') { const mammoth = await import('mammoth'); return (await mammoth.extractRawText({ path })).value }
  if (['.html', '.htm'].includes(ext)) return htmlToText(readFileSync(path, 'utf8'))
  return readFileSync(path, 'utf8')
}

async function requestOne(s: Source, rawUrl: string, query: string): Promise<string> {
  const sec = secretOf(s)
  const url = rawUrl.replace(/\{query\}/g, encodeURIComponent(query))
  const headers: Record<string, string> = { Accept: 'application/json, text/html;q=0.9, */*;q=0.8', 'User-Agent': 'Mail/0.1' }
  if (s.authKind === 'basic') headers.Authorization = 'Basic ' + Buffer.from(`${sec.username ?? ''}:${sec.password ?? ''}`).toString('base64')
  if (s.authKind === 'bearer') headers.Authorization = `Bearer ${sec.token ?? ''}`
  if (s.authKind === 'header' && sec.headerName) headers[sec.headerName] = sec.headerValue ?? ''
  if (s.authKind === 'cookie') headers.Cookie = sec.cookie ?? ''
  let body: string | undefined
  if (s.method === 'POST') { headers['Content-Type'] = 'application/json'; body = s.bodyTemplate.replace(/\{query\}/g, query.replace(/"/g, '\\"')) }
  const res = await fetch(url, { method: s.method, headers, body, signal: AbortSignal.timeout(20000) })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}${text ? ' — ' + text.slice(0, 200) : ''}`)
  const ct = res.headers.get('content-type') ?? ''
  if (/json/.test(ct)) { try { return JSON.stringify(JSON.parse(text), null, 1) } catch { return text } }
  if (/html/.test(ct) || /^\s*</.test(text)) return htmlToText(text)
  return text
}

// plusieurs URLs partageant la même authentification : lues et concaténées
async function request(s: Source, query: string): Promise<string> {
  const urls = s.urls.length ? s.urls : []
  if (!urls.length) throw new Error('aucune URL')
  const parts: string[] = []
  const errors: string[] = []
  for (const u of urls) {
    try { const t = await requestOne(s, u, query); parts.push(urls.length > 1 ? `## ${u}\n${t}` : t) } catch (e: any) { errors.push(`${u} : ${e?.message ?? e}`) }
  }
  if (!parts.length) throw new Error(errors.join(' ; '))
  return parts.join('\n\n')
}

export const SourceService = {
  async fetch(sourceId: string, query = ''): Promise<string> {
    const s = SourceRepo.get(sourceId)
    if (!s) throw new Error('source introuvable')
    if (s.kind === 'file') return clean(await readFile(s.filePath))
    if (s.kind === 'url') {
      if (s.cachedText && s.cachedAt && Date.now() - s.cachedAt < 6 * 3600_000) return s.cachedText
      const t = clean(await request(s, query)); SourceRepo.setCache(s.id, t); return t
    }
    return clean(await request(s, query))
  },
  async refresh(sourceId: string): Promise<string> {
    const s = SourceRepo.get(sourceId)
    if (!s) throw new Error('source introuvable')
    const t = clean(s.kind === 'file' ? await readFile(s.filePath) : await request(s, ''))
    SourceRepo.setCache(s.id, t)
    return t
  },
  async test(sourceId: string): Promise<{ ok: boolean; preview?: string; error?: string }> {
    try { const t = await this.refresh(sourceId); return { ok: true, preview: t.slice(0, 400) } } catch (e: any) { return { ok: false, error: e?.message ?? String(e) } }
  },
  // Sources de référence courtes (fichiers/urls) injectées telles quelles ; les autres sont exposées comme outils.
  async split(accountId: string): Promise<{ inline: { s: Source; text: string }[]; tools: Source[] }> {
    const inline: { s: Source; text: string }[] = []
    const tools: Source[] = []
    for (const s of SourceRepo.list(accountId).filter((x) => x.enabled)) {
      if (s.kind === 'api') { tools.push(s); continue }
      try {
        const t = s.cachedText && s.cachedAt && Date.now() - s.cachedAt < 6 * 3600_000 ? s.cachedText : await this.refresh(s.id)
        if (t.length <= INLINE_MAX) inline.push({ s, text: t }); else tools.push(s)
      } catch (e: any) { log.warn('sources', s.name, e?.message); tools.push(s) }
    }
    return { inline, tools }
  }
}