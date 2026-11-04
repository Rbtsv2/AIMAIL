// src/main/calendar/GoogleCalendar.ts
import type { Account } from '@shared/models/Account'
import type { Calendar, CalEvent, EventInput } from '@shared/models/Calendar'
import { resolveAuth } from '../auth'
import { CalendarRepo } from '../db/repositories/CalendarRepo'

const API = 'https://www.googleapis.com/calendar/v3'

async function call(account: Account, path: string, init: RequestInit = {}): Promise<any> {
  const auth = await resolveAuth(account)
  const res = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${auth.accessToken}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } })
  if (res.status === 403) throw new Error('accès à Google Agenda non autorisé : retirez et rajoutez le compte Gmail pour accorder la permission « Agenda »')
  if (res.status === 204) return null
  if (!res.ok) throw new Error(`Google Calendar ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

const toDate = (d: any): { t: number; allDay: boolean } => d?.date ? { t: new Date(d.date + 'T00:00:00').getTime(), allDay: true } : { t: Date.parse(d?.dateTime ?? 0), allDay: false }
const fromEvent = (e: EventInput) => ({
  summary: e.summary, description: e.description || undefined, location: e.location || undefined,
  start: e.allDay ? { date: new Date(e.start).toISOString().slice(0, 10) } : { dateTime: new Date(e.start).toISOString() },
  end: e.allDay ? { date: new Date(e.end).toISOString().slice(0, 10) } : { dateTime: new Date(e.end).toISOString() },
  recurrence: e.rrule ? [`RRULE:${e.rrule}`] : undefined,
  attendees: e.attendees.length ? e.attendees.map((a) => ({ email: a.address, displayName: a.name || undefined })) : undefined
})

export const GoogleCalendar = {
  async discover(account: Account): Promise<Calendar[]> {
    const j = await call(account, '/users/me/calendarList')
    const out: Calendar[] = []
    for (const c of j.items ?? []) {
      const existing = CalendarRepo.calendars().find((x) => x.kind === 'google' && x.accountId === account.id && x.remoteId === c.id)
      out.push(CalendarRepo.saveCalendar({ id: existing?.id, accountId: account.id, kind: 'google', name: c.summaryOverride || c.summary, color: c.backgroundColor || '#4285f4', remoteId: c.id, enabled: existing?.enabled ?? true, isDefault: existing?.isDefault ?? false, readOnly: !/owner|writer/.test(c.accessRole ?? '') }))
    }
    return out
  },
  async sync(account: Account, cal: Calendar, from: number, to: number): Promise<void> {
    let pageToken = ''
    const keep: string[] = []
    do {
      const q = new URLSearchParams({ singleEvents: 'false', maxResults: '2500', timeMin: new Date(from).toISOString(), timeMax: new Date(to).toISOString(), showDeleted: 'false' })
      if (pageToken) q.set('pageToken', pageToken)
      const j = await call(account, `/calendars/${encodeURIComponent(cal.remoteId!)}/events?${q}`)
      for (const g of j.items ?? []) {
        if (g.status === 'cancelled') continue
        const s = toDate(g.start), e = toDate(g.end)
        const existing = CalendarRepo.byRemote(cal.id, g.id)
        const rrule = (g.recurrence ?? []).find((r: string) => r.startsWith('RRULE:'))?.slice(6) ?? null
        CalendarRepo.saveEvent({ id: existing?.id, calendarId: cal.id, uid: g.iCalUID ?? g.id, summary: g.summary ?? '(sans titre)', description: g.description ?? '', location: g.location ?? '', start: s.t, end: e.t, allDay: s.allDay, rrule,
          organizer: g.organizer?.email ?? null, attendees: (g.attendees ?? []).map((a: any) => ({ name: a.displayName ?? '', address: a.email, status: (a.responseStatus === 'needsAction' ? 'needs-action' : a.responseStatus ?? 'needs-action') })),
          status: g.status === 'tentative' ? 'tentative' : 'confirmed', remoteId: g.id, etag: g.etag })
        keep.push(g.id)
      }
      pageToken = j.nextPageToken ?? ''
    } while (pageToken)
    CalendarRepo.removeMissing(cal.id, keep)
  },
  async create(account: Account, cal: Calendar, e: EventInput): Promise<CalEvent> {
    const g = await call(account, `/calendars/${encodeURIComponent(cal.remoteId!)}/events`, { method: 'POST', body: JSON.stringify(fromEvent(e)) })
    return CalendarRepo.saveEvent({ ...e, id: e.id, uid: g.iCalUID ?? g.id, remoteId: g.id, etag: g.etag })
  },
  async update(account: Account, cal: Calendar, ev: CalEvent, e: EventInput): Promise<CalEvent> {
    const g = await call(account, `/calendars/${encodeURIComponent(cal.remoteId!)}/events/${encodeURIComponent(ev.remoteId!)}`, { method: 'PATCH', body: JSON.stringify(fromEvent(e)) })
    return CalendarRepo.saveEvent({ ...e, id: ev.id, uid: ev.uid, remoteId: g.id, etag: g.etag })
  },
  async remove(account: Account, cal: Calendar, ev: CalEvent): Promise<void> {
    await call(account, `/calendars/${encodeURIComponent(cal.remoteId!)}/events/${encodeURIComponent(ev.remoteId!)}`, { method: 'DELETE' })
    CalendarRepo.removeEvent(ev.id)
  }
}