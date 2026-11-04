// src/main/calendar/MicrosoftCalendar.ts
import type { Account } from '@shared/models/Account'
import type { Calendar, CalEvent, EventInput } from '@shared/models/Calendar'
import { CalendarRepo } from '../db/repositories/CalendarRepo'
import { graphToken } from '../auth/oauth/microsoftGraph'

const API = 'https://graph.microsoft.com/v1.0'

async function call(account: Account, path: string, init: RequestInit = {}): Promise<any> {
  const token = await graphToken(account.id)
  const res = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'outlook.timezone="UTC"', ...(init.headers ?? {}) } })
  if (res.status === 204) return null
  if (!res.ok) throw new Error(`Microsoft Graph ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}
const toDate = (d: any, allDay: boolean): number => { const t = Date.parse((d?.dateTime ?? '') + (d?.timeZone === 'UTC' ? 'Z' : '')); return allDay ? new Date(t + new Date(t).getTimezoneOffset() * 60000).getTime() : t }
const fromEvent = (e: EventInput) => ({
  subject: e.summary, body: { contentType: 'text', content: e.description }, location: e.location ? { displayName: e.location } : undefined, isAllDay: e.allDay,
  start: { dateTime: e.allDay ? new Date(e.start - new Date(e.start).getTimezoneOffset() * 60000).toISOString().slice(0, 19) : new Date(e.start).toISOString().slice(0, 19), timeZone: 'UTC' },
  end: { dateTime: e.allDay ? new Date(e.end - new Date(e.end).getTimezoneOffset() * 60000).toISOString().slice(0, 19) : new Date(e.end).toISOString().slice(0, 19), timeZone: 'UTC' },
  attendees: e.attendees.map((a) => ({ emailAddress: { address: a.address, name: a.name || undefined }, type: 'required' }))
})

export const MicrosoftCalendar = {
  async discover(account: Account): Promise<Calendar[]> {
    const j = await call(account, '/me/calendars?$top=50')
    const out: Calendar[] = []
    for (const c of j.value ?? []) {
      const existing = CalendarRepo.calendars().find((x) => x.kind === 'microsoft' && x.accountId === account.id && x.remoteId === c.id)
      const shared = c.owner?.address && c.owner.address.toLowerCase() !== account.email.toLowerCase()
      out.push(CalendarRepo.saveCalendar({ id: existing?.id, accountId: account.id, kind: 'microsoft', name: shared ? `${c.name} (${c.owner.name ?? c.owner.address})` : c.name, color: existing?.color ?? (c.hexColor || '#0078d4'), remoteId: c.id, enabled: existing?.enabled ?? true, isDefault: existing?.isDefault ?? false, readOnly: c.canEdit === false }))
    }
    return out
  },
  async sync(account: Account, cal: Calendar, from: number, to: number): Promise<void> {
    // calendarView renvoie les occurrences déjà développées (récurrences incluses)
    let url: string | null = `/me/calendars/${cal.remoteId}/calendarView?startDateTime=${new Date(from).toISOString()}&endDateTime=${new Date(to).toISOString()}&$top=500&$select=id,iCalUId,subject,bodyPreview,location,start,end,isAllDay,organizer,attendees,showAs,isCancelled`
    const keep: string[] = []
    while (url) {
      const j: any = await call(account, url)
      for (const g of j.value ?? []) {
        if (g.isCancelled) continue
        const existing = CalendarRepo.byRemote(cal.id, g.id)
        CalendarRepo.saveEvent({ id: existing?.id, calendarId: cal.id, uid: g.iCalUId ?? g.id, summary: g.subject ?? '(sans titre)', description: g.bodyPreview ?? '', location: g.location?.displayName ?? '', start: toDate(g.start, g.isAllDay), end: toDate(g.end, g.isAllDay), allDay: !!g.isAllDay, rrule: null,
          organizer: g.organizer?.emailAddress?.address ?? null, attendees: (g.attendees ?? []).map((a: any) => ({ name: a.emailAddress?.name ?? '', address: a.emailAddress?.address ?? '', status: ({ accepted: 'accepted', declined: 'declined', tentativelyAccepted: 'tentative' } as any)[a.status?.response] ?? 'needs-action' })),
          status: g.showAs === 'tentative' ? 'tentative' : 'confirmed', remoteId: g.id })
        keep.push(g.id)
      }
      url = j['@odata.nextLink'] ? j['@odata.nextLink'].replace(API, '') : null
    }
    CalendarRepo.removeMissing(cal.id, keep)
  },
  async create(account: Account, cal: Calendar, e: EventInput): Promise<CalEvent> {
    const g = await call(account, `/me/calendars/${cal.remoteId}/events`, { method: 'POST', body: JSON.stringify(fromEvent(e)) })
    return CalendarRepo.saveEvent({ ...e, uid: g.iCalUId ?? g.id, remoteId: g.id })
  },
  async update(account: Account, _cal: Calendar, ev: CalEvent, e: EventInput): Promise<CalEvent> {
    const g = await call(account, `/me/events/${ev.remoteId}`, { method: 'PATCH', body: JSON.stringify(fromEvent(e)) })
    return CalendarRepo.saveEvent({ ...e, id: ev.id, uid: ev.uid, remoteId: g.id })
  },
  async remove(account: Account, _cal: Calendar, ev: CalEvent): Promise<void> {
    await call(account, `/me/events/${ev.remoteId}`, { method: 'DELETE' })
    CalendarRepo.removeEvent(ev.id)
  }
}