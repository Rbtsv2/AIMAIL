// src/shared/search.ts — filtres de recherche avancée et analyse des opérateurs (de:, à:, objet:, avant:, après:, pj, nonlu, suivi)
export interface ThreadFilter {
  unread?: boolean
  starred?: boolean
  attachments?: boolean
  category?: 'urgent' | 'action' | 'info' | 'newsletter' | 'spam'
  from?: string
  to?: string
  subject?: string
  after?: number     // timestamp ms
  before?: number
}

export const EMPTY_FILTER: ThreadFilter = {}
export const hasFilter = (f: ThreadFilter): boolean => Object.values(f).some((v) => v !== undefined && v !== false && v !== '')

const nz = (x: string) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

function parseDate(v: string, end = false): number | undefined {
  const m = v.match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/) ?? v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return undefined
  let y: number, mo: number, d: number
  if (v.includes('/')) { d = +m[1]; mo = +m[2]; y = +m[3] } else { y = +m[1]; mo = m[2] ? +m[2] : end ? 12 : 1; d = m[3] ? +m[3] : end ? new Date(y, mo, 0).getDate() : 1 }
  const t = new Date(y, mo - 1, d, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0).getTime()
  return Number.isFinite(t) ? t : undefined
}

/** Sépare les opérateurs du texte libre : « de:ducap objet:facture pj après:2025 » */
export function parseQuery(input: string): { text: string; filter: ThreadFilter } {
  const filter: ThreadFilter = {}
  const rest: string[] = []
  const tokens = input.match(/(?:[^\s"]+|"[^"]*")+/g) ?? []
  for (const raw of tokens) {
    const t = raw.replace(/^"|"$/g, '')
    const m = t.match(/^([^:]+):(.*)$/)
    const key = m ? nz(m[1]) : nz(t)
    const val = m ? m[2].replace(/^"|"$/g, '') : ''
    if (m && val) {
      if (['de', 'from', 'exp', 'expediteur'].includes(key)) { filter.from = val; continue }
      if (['a', 'to', 'pour', 'dest'].includes(key)) { filter.to = val; continue }
      if (['objet', 'sujet', 'subject'].includes(key)) { filter.subject = val; continue }
      if (['apres', 'depuis', 'after', 'since'].includes(key)) { filter.after = parseDate(val); continue }
      if (['avant', 'before', 'jusqu', 'jusqua'].includes(key)) { filter.before = parseDate(val, true); continue }
      if (['le', 'date', 'on', 'jour'].includes(key)) { filter.after = parseDate(val); filter.before = parseDate(val, true); continue }
      if (['cat', 'categorie', 'category', 'tag'].includes(key)) { const c = nz(val); if (['urgent', 'action', 'info', 'newsletter', 'spam'].includes(c)) filter.category = c as ThreadFilter['category']; continue }
      if (['est', 'is'].includes(key)) { const c = nz(val); if (c === 'nonlu' || c === 'unread') filter.unread = true; else if (c === 'suivi' || c === 'starred') filter.starred = true; continue }
      if (['a', 'has'].includes(key) && ['pj', 'attachment'].includes(nz(val))) { filter.attachments = true; continue }
    }
    if (!m) {
      if (['pj', 'piece-jointe', 'pièce-jointe'].includes(key)) { filter.attachments = true; continue }
      if (['nonlu', 'non-lu', 'nonlus'].includes(key)) { filter.unread = true; continue }
      if (['suivi', 'suivis', 'etoile'].includes(key)) { filter.starred = true; continue }
    }
    rest.push(t)
  }
  return { text: rest.join(' ').trim(), filter }
}