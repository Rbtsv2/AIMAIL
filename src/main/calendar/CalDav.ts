// src/main/calendar/CalDav.ts
import type { Calendar, CalEvent, EventInput, CaldavInput } from '@shared/models/Calendar'
import { CalendarRepo } from '../db/repositories/CalendarRepo'
import { Credentials } from '../auth/Credentials'
import { parseIcs, buildIcs, fmtUtc } from './ical'

const creds = (cal: Calendar): { username: string; password: string } => { const v = Credentials.get(`caldav:${cal.id}`); return v ? JSON.parse(v) : { username: '', password: '' } }
const authHeader = (u: string, p: string) => 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64')

async function dav(url: string, method: string, auth: string, body?: string, headers: Record<string, string> = {}): Promise<{ status: number; text: string; headers: Headers }> {
  const res = await fetch(url, { method, body, headers: { Authorization: auth, 'Content-Type': 'application/xml; charset=utf-8', Depth: '1', ...headers }, signal: AbortSignal.timeout(30000) })
  return { status: res.status, text: await res.text(), headers: res.headers }
}
const tag = (xml: string, name: string): string[] => [...xml.matchAll(new RegExp(`<(?:[a-zA-Z0-9]+:)?${name}[^>]*>([\\s\\S]*?)</(?:[a-zA-Z0-9]+:)?${name}>`, 'g'))].map((m) => m[1])
const href = (xml: string): string => (tag(xml, 'href')[0] ?? '').trim()
const unxml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
const resolve = (base: string, h: string) => new URL(h, base).toString()

export const CalDav = {
  // découverte : principal → calendar-home-set → calendriers
  async discover(input: CaldavInput): Promise<Calendar[]> {
    const auth = authHeader(input.username, input.password)
    let base = input.url.trim()
    if (!/^https?:\/\//.test(base)) base = 'https://' + base
    // 1. principal courant
    const propfind = (u: string, props: string, depth = '0') => dav(u, 'PROPFIND', auth, `<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop>${props}</d:prop></d:propfind>`, { Depth: depth })
    let r = await propfind(base, '<d:current-user-principal/>')
    if (r.status === 401) throw new Error('identifiants refusés')
    let principal = href(tag(r.text, 'current-user-principal')[0] ?? '')
    let home = ''
    if (principal) {
      r = await propfind(resolve(base, principal), '<c:calendar-home-set/>')
      home = href(tag(r.text, 'calendar-home-set')[0] ?? '')
    }
    const homeUrl = home ? resolve(base, home) : base
    r = await propfind(homeUrl, '<d:displayname/><d:resourcetype/><c:supported-calendar-component-set/><cs:getctag xmlns:cs="http://calendarserver.org/ns/"/><ic:calendar-color xmlns:ic="http://apple.com/ns/ical/"/>', '1')
    if (r.status >= 400) throw new Error(`CalDAV ${r.status}`)
    const out: Calendar[] = []
    for (const resp of tag(r.text, 'response')) {
      const rt = tag(resp, 'resourcetype')[0] ?? ''
      if (!/calendar/i.test(rt) || /collection>\s*$/.test(rt) && !/calendar/i.test(rt)) continue
      if (!/<(?:[a-z0-9]+:)?calendar\b/i.test(rt)) continue
      const comp = tag(resp, 'supported-calendar-component-set')[0]
      if (comp && !/VEVENT/.test(comp)) continue
      const url = resolve(base, href(resp))
      const name = unxml(tag(resp, 'displayname')[0] ?? '') || url.split('/').filter(Boolean).pop() || 'Agenda'
      const color = (tag(resp, 'calendar-color')[0] ?? '').trim().slice(0, 7) || '#2eaf8a'
      const existing = CalendarRepo.calendars().find((c) => c.kind === 'caldav' && c.url === url)
      const cal = CalendarRepo.saveCalendar({ id: existing?.id, accountId: input.accountId, kind: 'caldav', name: existing?.name ?? name, color: existing?.color ?? color, url, enabled: existing?.enabled ?? true, isDefault: existing?.isDefault ?? false, readOnly: false })
      Credentials.set(`caldav:${cal.id}`, JSON.stringify({ username: input.username, password: input.password }))
      out.push(cal)
    }
    if (!out.length) throw new Error('aucun agenda trouvé à cette adresse')
    return out
  },
  async sync(cal: Calendar, from: number, to: number): Promise<void> {
    const { username, password } = creds(cal)
    const auth = authHeader(username, password)
    const body = `<?xml version="1.0"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="${fmtUtc(from)}" end="${fmtUtc(to)}"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>`
    const r = await dav(cal.url!, 'REPORT', auth, body, { Depth: '1' })
    if (r.status === 401) throw new Error(`${cal.name} : identifiants refusés`)
    if (r.status >= 400) throw new Error(`${cal.name} : CalDAV ${r.status}`)
    const keep: string[] = []
    for (const resp of tag(r.text, 'response')) {
      const h = href(resp)
      const etag = (tag(resp, 'getetag')[0] ?? '').trim()
      const ics = unxml(tag(resp, 'calendar-data')[0] ?? '')
      if (!ics) continue
      const parsed = parseIcs(ics)
      const master = parsed.events.find((e) => e.uid) ?? parsed.events[0]
      if (!master) continue
      const existing = CalendarRepo.byRemote(cal.id, h)
      CalendarRepo.saveEvent({ id: existing?.id, calendarId: cal.id, uid: master.uid, summary: master.summary, description: master.description, location: master.location, start: master.start, end: master.end, allDay: master.allDay, rrule: master.rrule,
        organizer: master.organizer?.address ?? null, attendees: master.attendees, status: master.status, remoteId: h, etag, ics })
      keep.push(h)
    }
    CalendarRepo.removeMissing(cal.id, keep)
  },
  async put(cal: Calendar, e: EventInput & { id?: string }, existing?: CalEvent): Promise<CalEvent> {
    const { username, password } = creds(cal)
    const auth = authHeader(username, password)
    const uid = existing?.uid ?? e.uid ?? `${crypto.randomUUID()}@mail.local`
    const ics = buildIcs({ ...e, uid, attendees: e.attendees, organizer: e.organizer ? { name: '', address: e.organizer } : null })
    const url = existing?.remoteId ? resolve(cal.url!, existing.remoteId) : `${cal.url!.replace(/\/?$/, '/')}${uid.replace(/[^A-Za-z0-9@._-]/g, '')}.ics`
    const headers: Record<string, string> = { 'Content-Type': 'text/calendar; charset=utf-8' }
    if (existing) { const et = CalendarRepo.etag(existing.id); if (et) headers['If-Match'] = et } else headers['If-None-Match'] = '*'
    const r = await dav(url, 'PUT', auth, ics, headers)
    if (r.status >= 400) throw new Error(`CalDAV PUT ${r.status}`)
    const remoteId = existing?.remoteId ?? new URL(url).pathname
    return CalendarRepo.saveEvent({ ...e, id: existing?.id ?? e.id, uid, remoteId, etag: r.headers.get('etag') ?? null, ics })
  },
  async remove(cal: Calendar, ev: CalEvent): Promise<void> {
    const { username, password } = creds(cal)
    const r = await dav(resolve(cal.url!, ev.remoteId!), 'DELETE', authHeader(username, password), undefined, {})
    if (r.status >= 400 && r.status !== 404) throw new Error(`CalDAV DELETE ${r.status}`)
    CalendarRepo.removeEvent(ev.id)
  }
}