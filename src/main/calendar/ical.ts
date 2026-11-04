// src/main/calendar/ical.ts
import type { Attendee, CalEvent } from '@shared/models/Calendar'

export interface ParsedEvent {
  uid: string; summary: string; description: string; location: string; start: number; end: number; allDay: boolean
  rrule: string | null; organizer: { name: string; address: string } | null; attendees: Attendee[]; status: CalEvent['status']; method: string | null; sequence: number
}

const unfold = (t: string) => t.replace(/\r?\n[ \t]/g, '')
const unesc = (v: string) => v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
export const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')

function parseDate(val: string, params: Record<string, string>): { t: number; allDay: boolean } {
  if (params.VALUE === 'DATE' || /^\d{8}$/.test(val)) {
    const y = +val.slice(0, 4), m = +val.slice(4, 6) - 1, d = +val.slice(6, 8)
    return { t: new Date(y, m, d).getTime(), allDay: true }
  }
  const m = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/)
  if (!m) return { t: Date.parse(val) || Date.now(), allDay: false }
  const [, Y, M, D, h, mi, s, z] = m
  if (z) return { t: Date.UTC(+Y, +M - 1, +D, +h, +mi, +(s ?? 0)), allDay: false }
  if (params.TZID) {
    // conversion depuis le fuseau indiqué via Intl
    try {
      const guess = Date.UTC(+Y, +M - 1, +D, +h, +mi, +(s ?? 0))
      const fmt = new Intl.DateTimeFormat('en-US', { timeZone: params.TZID, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      const parts = Object.fromEntries(fmt.formatToParts(new Date(guess)).map((p) => [p.type, p.value]))
      const asTz = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second)
      return { t: guess - (asTz - guess), allDay: false }
    } catch {}
  }
  return { t: new Date(+Y, +M - 1, +D, +h, +mi, +(s ?? 0)).getTime(), allDay: false }
}

function addrOf(val: string, params: Record<string, string>): { name: string; address: string } {
  return { name: unesc(params.CN ?? ''), address: val.replace(/^mailto:/i, '').toLowerCase() }
}

export function parseIcs(text: string): { method: string | null; events: ParsedEvent[] } {
  const lines = unfold(text).split(/\r?\n/)
  let method: string | null = null
  const events: ParsedEvent[] = []
  let cur: ParsedEvent | null = null
  for (const line of lines) {
    const m = line.match(/^([A-Za-z0-9-]+)((?:;[^:]*)*):(.*)$/)
    if (!m) continue
    const key = m[1].toUpperCase()
    const params: Record<string, string> = {}
    for (const p of m[2].split(';').filter(Boolean)) { const [k, ...v] = p.split('='); params[k.toUpperCase()] = v.join('=').replace(/^"|"$/g, '') }
    const val = m[3]
    if (key === 'METHOD') method = val.toUpperCase()
    if (key === 'BEGIN' && val.toUpperCase() === 'VEVENT') { cur = { uid: '', summary: '', description: '', location: '', start: 0, end: 0, allDay: false, rrule: null, organizer: null, attendees: [], status: 'confirmed', method, sequence: 0 }; continue }
    if (key === 'END' && val.toUpperCase() === 'VEVENT') { if (cur) { if (!cur.end) cur.end = cur.allDay ? cur.start + 86400_000 : cur.start + 3600_000; cur.method = method; events.push(cur) } cur = null; continue }
    if (!cur) continue
    if (key === 'UID') cur.uid = val
    else if (key === 'SUMMARY') cur.summary = unesc(val)
    else if (key === 'DESCRIPTION') cur.description = unesc(val)
    else if (key === 'LOCATION') cur.location = unesc(val)
    else if (key === 'DTSTART') { const d = parseDate(val, params); cur.start = d.t; cur.allDay = d.allDay }
    else if (key === 'DTEND') cur.end = parseDate(val, params).t
    else if (key === 'DURATION') { const dm = val.match(/P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/); if (dm) cur.end = cur.start + ((+(dm[1] ?? 0)) * 86400 + (+(dm[2] ?? 0)) * 3600 + (+(dm[3] ?? 0)) * 60) * 1000 }
    else if (key === 'RRULE') cur.rrule = val
    else if (key === 'ORGANIZER') cur.organizer = addrOf(val, params)
    else if (key === 'ATTENDEE') cur.attendees.push({ ...addrOf(val, params), status: ((params.PARTSTAT ?? 'NEEDS-ACTION').toLowerCase() as Attendee['status']) })
    else if (key === 'STATUS') cur.status = val.toLowerCase() === 'cancelled' ? 'cancelled' : val.toLowerCase() === 'tentative' ? 'tentative' : 'confirmed'
    else if (key === 'SEQUENCE') cur.sequence = +val || 0
  }
  return { method, events }
}

const pad = (n: number) => String(n).padStart(2, '0')
export const fmtUtc = (t: number) => { const d = new Date(t); return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z` }
export const fmtDate = (t: number) => { const d = new Date(t); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` }

export function buildIcs(e: { uid: string; summary: string; description: string; location: string; start: number; end: number; allDay: boolean; rrule: string | null; organizer?: { name: string; address: string } | null; attendees?: Attendee[]; status?: string }, opts: { method?: string; sequence?: number } = {}): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ChilloutNetworks//Mail//FR', ...(opts.method ? [`METHOD:${opts.method}`] : []), 'BEGIN:VEVENT',
    `UID:${e.uid}`, `DTSTAMP:${fmtUtc(Date.now())}`, `SEQUENCE:${opts.sequence ?? 0}`,
    e.allDay ? `DTSTART;VALUE=DATE:${fmtDate(e.start)}` : `DTSTART:${fmtUtc(e.start)}`,
    e.allDay ? `DTEND;VALUE=DATE:${fmtDate(e.end)}` : `DTEND:${fmtUtc(e.end)}`,
    `SUMMARY:${esc(e.summary)}`]
  if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`)
  if (e.location) lines.push(`LOCATION:${esc(e.location)}`)
  if (e.rrule) lines.push(`RRULE:${e.rrule}`)
  if (e.status) lines.push(`STATUS:${e.status.toUpperCase()}`)
  if (e.organizer) lines.push(`ORGANIZER;CN=${esc(e.organizer.name || e.organizer.address)}:mailto:${e.organizer.address}`)
  for (const a of e.attendees ?? []) lines.push(`ATTENDEE;CN=${esc(a.name || a.address)};PARTSTAT=${a.status.toUpperCase()};RSVP=TRUE:mailto:${a.address}`)
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.map((l) => l.length > 73 ? l.match(/.{1,73}/g)!.join('\r\n ') : l).join('\r\n') + '\r\n'
}

// ---- expansion des récurrences (FREQ daily/weekly/monthly/yearly, INTERVAL, COUNT, UNTIL, BYDAY hebdo)
const DOW = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
export function expand(e: { start: number; end: number; rrule: string | null }, from: number, to: number, max = 500): { start: number; end: number }[] {
  if (!e.rrule) return e.end >= from && e.start <= to ? [{ start: e.start, end: e.end }] : []
  const r: Record<string, string> = {}
  for (const part of e.rrule.split(';')) { const [k, v] = part.split('='); if (k) r[k.toUpperCase()] = v ?? '' }
  const freq = r.FREQ, interval = Math.max(1, +(r.INTERVAL ?? 1)), count = r.COUNT ? +r.COUNT : Infinity
  const until = r.UNTIL ? (parseDate(r.UNTIL, {}).t) : Infinity
  const dur = e.end - e.start
  const byday = r.BYDAY ? r.BYDAY.split(',').map((d) => DOW.indexOf(d.replace(/^[-+]?\d+/, ''))).filter((i) => i >= 0) : null
  const out: { start: number; end: number }[] = []
  let n = 0, i = 0
  const base = new Date(e.start)
  while (n < count && out.length < max) {
    const d = new Date(base)
    if (freq === 'DAILY') d.setDate(base.getDate() + i * interval)
    else if (freq === 'WEEKLY') d.setDate(base.getDate() + i * 7 * interval)
    else if (freq === 'MONTHLY') d.setMonth(base.getMonth() + i * interval)
    else if (freq === 'YEARLY') d.setFullYear(base.getFullYear() + i * interval)
    else break
    i++
    if (d.getTime() > until || d.getTime() > to + 7 * 86400_000) break
    const candidates: Date[] = []
    if (freq === 'WEEKLY' && byday && byday.length) {
      const weekStart = new Date(d); weekStart.setDate(d.getDate() - d.getDay())
      for (const dow of byday) { const c = new Date(weekStart); c.setDate(weekStart.getDate() + dow); c.setHours(base.getHours(), base.getMinutes(), 0, 0); if (c.getTime() >= e.start) candidates.push(c) }
      candidates.sort((a, b) => a.getTime() - b.getTime())
    } else candidates.push(d)
    for (const c of candidates) {
      if (n >= count) break
      n++
      const s = c.getTime()
      if (s > until) break
      if (s + dur >= from && s <= to) out.push({ start: s, end: s + dur })
    }
    if (i > 5000) break
  }
  return out
}

export function rruleLabel(rrule: string | null): string {
  if (!rrule) return ''
  const r: Record<string, string> = {}
  for (const part of rrule.split(';')) { const [k, v] = part.split('='); if (k) r[k.toUpperCase()] = v ?? '' }
  const iv = +(r.INTERVAL ?? 1)
  const base = { DAILY: iv > 1 ? `Tous les ${iv} jours` : 'Tous les jours', WEEKLY: iv > 1 ? `Toutes les ${iv} semaines` : 'Toutes les semaines', MONTHLY: iv > 1 ? `Tous les ${iv} mois` : 'Tous les mois', YEARLY: 'Tous les ans' }[r.FREQ ?? ''] ?? 'Récurrent'
  const days: Record<string, string> = { MO: 'lun.', TU: 'mar.', WE: 'mer.', TH: 'jeu.', FR: 'ven.', SA: 'sam.', SU: 'dim.' }
  const by = r.BYDAY ? ' le ' + r.BYDAY.split(',').map((d) => days[d] ?? d).join(', ') : ''
  return base + by + (r.COUNT ? `, ${r.COUNT} fois` : '') + (r.UNTIL ? `, jusqu’au ${new Date(parseDate(r.UNTIL, {}).t).toLocaleDateString('fr-FR')}` : '')
}