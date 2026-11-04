// src/main/contacts/importers.ts
import { readFileSync } from 'fs'
import { extname } from 'path'
import Database from 'better-sqlite3'
import type { ContactInput, ImportFormat } from '@shared/models/Contact'

const blank = (): ContactInput => ({ accountId: null, firstName: '', lastName: '', displayName: '', emails: [], phones: [], org: '', title: '', notes: '', source: 'import', googleId: null, starred: false })

export const detectFormat = (path: string): ImportFormat => {
  const ext = extname(path).toLowerCase()
  if (ext === '.tsv' || ext === '.tab') return 'tsv'
  if (ext === '.vcf' || ext === '.vcard') return 'vcf'
  if (ext === '.ldif') return 'ldif'
  if (ext === '.sqlite' || ext === '.db') return 'sqlite'
  if (ext === '.mab') return 'mab'
  return 'csv'
}

// ---------- CSV / TSV (en-têtes Thunderbird, Outlook, Gmail, Apple) ----------
function parseDelimited(text: string, delim: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else q = false } else cell += ch; continue }
    if (ch === '"') q = true
    else if (ch === delim) { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim()))
}

const H = {
  first: /^(first ?name|prénom|prenom|given ?name|vorname)$/i,
  last: /^(last ?name|nom|nom de famille|surname|family ?name|nachname)$/i,
  display: /^(display ?name|nom affiché|nom d'affichage|name|nom complet|full ?name)$/i,
  email: /e-?mail|courriel|adresse électronique/i,
  phone: /phone|tel|téléphone|telephone|mobile|portable|cellular|fax/i,
  org: /^(organization|organisation|company|société|societe|entreprise|org)$/i,
  title: /^(job ?title|title|fonction|poste)$/i,
  notes: /^(notes?|commentaire|remarques?)$/i
}

export function importDelimited(text: string, delim: string): ContactInput[] {
  const rows = parseDelimited(text.replace(/^\uFEFF/, ''), delim)
  if (rows.length < 2) return []
  const head = rows[0].map((h) => h.trim())
  const out: ContactInput[] = []
  for (const r of rows.slice(1)) {
    const c = blank()
    head.forEach((h, i) => {
      const v = (r[i] ?? '').trim()
      if (!v) return
      if (H.first.test(h)) c.firstName = v
      else if (H.last.test(h)) c.lastName = v
      else if (H.display.test(h)) c.displayName = v
      else if (H.email.test(h)) c.emails.push(...v.split(/[;,\s]+/).filter(Boolean))
      else if (H.phone.test(h)) c.phones.push(v)
      else if (H.org.test(h)) c.org = v
      else if (H.title.test(h)) c.title = v
      else if (H.notes.test(h)) c.notes = v
    })
    if (c.emails.length || c.displayName || c.firstName || c.lastName) out.push(c)
  }
  return out
}

// ---------- vCard ----------
const unfold = (t: string) => t.replace(/\r?\n[ \t]/g, '')
const unescapeV = (v: string) => v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
function decodeQP(v: string): string { try { return Buffer.from(v.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_m, h) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('utf8') } catch { return v } }

export function importVcard(text: string): ContactInput[] {
  const out: ContactInput[] = []
  for (const block of unfold(text).split(/BEGIN:VCARD/i).slice(1)) {
    const c = blank()
    for (const line of block.split(/\r?\n/)) {
      const m = line.match(/^([^:;]+)((?:;[^:]+)*):(.*)$/)
      if (!m) continue
      const key = m[1].toUpperCase(), params = m[2].toUpperCase()
      let val = m[3]
      if (/ENCODING=QUOTED-PRINTABLE/.test(params)) val = decodeQP(val)
      val = unescapeV(val)
      if (key === 'FN') c.displayName = val
      else if (key === 'N') { const [last = '', first = ''] = val.split(';'); c.lastName = last; c.firstName = first }
      else if (key === 'EMAIL' || key.endsWith('.EMAIL')) c.emails.push(val)
      else if (key === 'TEL' || key.endsWith('.TEL')) c.phones.push(val.replace(/^tel:/i, ''))
      else if (key === 'ORG') c.org = val.split(';')[0]
      else if (key === 'TITLE') c.title = val
      else if (key === 'NOTE') c.notes = val
    }
    if (c.emails.length || c.displayName || c.firstName || c.lastName) out.push(c)
  }
  return out
}

// ---------- LDIF ----------
export function importLdif(text: string): ContactInput[] {
  const out: ContactInput[] = []
  for (const block of text.replace(/\r?\n /g, '').split(/\r?\n\s*\r?\n/)) {
    const c = blank()
    let any = false
    for (const line of block.split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z0-9-]+)(::?)\s*(.*)$/)
      if (!m) continue
      const key = m[1].toLowerCase()
      const val = m[2] === '::' ? Buffer.from(m[3], 'base64').toString('utf8') : m[3]
      if (key === 'givenname') c.firstName = val
      else if (key === 'sn') c.lastName = val
      else if (key === 'cn' || key === 'displayname') c.displayName = c.displayName || val
      else if (key === 'mail' || key === 'mozillasecondemail') c.emails.push(val)
      else if (/telephonenumber|mobile|homephone|facsimiletelephonenumber|pager/.test(key)) c.phones.push(val)
      else if (key === 'o' || key === 'company') c.org = val
      else if (key === 'title') c.title = val
      else if (key === 'description') c.notes = val
      else continue
      any = true
    }
    if (any && (c.emails.length || c.displayName || c.firstName || c.lastName)) out.push(c)
  }
  return out
}

// ---------- SQLite Thunderbird (abook.sqlite : table properties(card, name, value)) ----------
export function importSqlite(path: string): ContactInput[] {
  const db = new Database(path, { readonly: true, fileMustExist: true })
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name)
    if (!tables.includes('properties')) throw new Error('base SQLite non reconnue (attendu : carnet Thunderbird abook.sqlite)')
    const rows = db.prepare('SELECT card, name, value FROM properties').all() as { card: string; name: string; value: string }[]
    const cards = new Map<string, Record<string, string>>()
    for (const r of rows) { const o = cards.get(r.card) ?? {}; o[r.name] = r.value; cards.set(r.card, o) }
    const out: ContactInput[] = []
    for (const o of cards.values()) {
      const c = blank()
      c.firstName = o.FirstName ?? ''; c.lastName = o.LastName ?? ''; c.displayName = o.DisplayName ?? ''
      for (const k of ['PrimaryEmail', 'SecondEmail']) if (o[k]) c.emails.push(o[k])
      for (const k of ['CellularNumber', 'WorkPhone', 'HomePhone', 'FaxNumber', 'PagerNumber']) if (o[k]) c.phones.push(o[k])
      c.org = o.Company ?? ''; c.title = o.JobTitle ?? ''; c.notes = o.Notes ?? ''
      if (c.emails.length || c.displayName || c.firstName || c.lastName) out.push(c)
    }
    return out
  } finally { db.close() }
}

// ---------- Mork (.mab, anciens carnets Thunderbird) : lecture minimale ----------
export function importMork(text: string): ContactInput[] {
  const dict = new Map<string, string>()
  const colDict = new Map<string, string>()
  // dictionnaires <(id=value)>
  for (const m of text.matchAll(/<\s*(?:<\(a=c\)>)?\s*([\s\S]*?)>/g)) {
    const isCol = /\(a=c\)/.test(m[0])
    for (const e of m[1].matchAll(/\(([0-9A-F]+)=([^)]*)\)/gi)) {
      const val = e[2].replace(/\$([0-9A-F]{2})/gi, (_x, h) => String.fromCharCode(parseInt(h, 16)))
      ;(isCol ? colDict : dict).set(e[1].toUpperCase(), val)
    }
  }
  const out: ContactInput[] = []
  for (const rowM of text.matchAll(/\[\s*-?[0-9A-F]+(?::\^[0-9A-F]+)?\s*([\s\S]*?)\]/gi)) {
    const o: Record<string, string> = {}
    for (const cell of rowM[1].matchAll(/\(\^([0-9A-F]+)\^([0-9A-F]+)\)/gi)) {
      const col = colDict.get(cell[1].toUpperCase()); const val = dict.get(cell[2].toUpperCase())
      if (col && val !== undefined) o[col] = val
    }
    for (const cell of rowM[1].matchAll(/\(\^([0-9A-F]+)=([^)]*)\)/gi)) { const col = colDict.get(cell[1].toUpperCase()); if (col) o[col] = cell[2] }
    if (!o.PrimaryEmail && !o.DisplayName) continue
    const c = blank()
    c.firstName = o.FirstName ?? ''; c.lastName = o.LastName ?? ''; c.displayName = o.DisplayName ?? ''
    for (const k of ['PrimaryEmail', 'SecondEmail']) if (o[k]) c.emails.push(o[k])
    for (const k of ['CellularNumber', 'WorkPhone', 'HomePhone']) if (o[k]) c.phones.push(o[k])
    c.org = o.Company ?? ''; c.notes = o.Notes ?? ''
    out.push(c)
  }
  return out
}

export function importFile(path: string, format?: ImportFormat): ContactInput[] {
  const f = format ?? detectFormat(path)
  if (f === 'sqlite') return importSqlite(path)
  const text = readFileSync(path, 'utf8')
  if (f === 'vcf') return importVcard(text)
  if (f === 'ldif') return importLdif(text)
  if (f === 'mab') return importMork(text)
  if (f === 'tsv') return importDelimited(text, '\t')
  const firstLine = text.split(/\r?\n/)[0] ?? ''
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : (firstLine.includes('\t') ? '\t' : ',')
  return importDelimited(text, delim)
}