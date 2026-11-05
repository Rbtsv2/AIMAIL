// src/main/calendar/IcsSubscription.ts
// Abonnement à un agenda par URL iCal (adresse secrète Google Agenda, Outlook « publier », Apple, etc.) : lecture seule, sans OAuth.
import type { Calendar } from '@shared/models/Calendar'
import { parseIcs } from './ical'
import { CalendarRepo } from '../db/repositories/CalendarRepo'

const normalize = (u: string) => u.trim().replace(/^webcal:\/\//i, 'https://')

export const IcsSubscription = {
  /** Vérifie l'URL et renvoie le nom proposé (X-WR-CALNAME) et le nombre d'événements. */
  async probe(url: string): Promise<{ name: string; count: number }> {
    const res = await fetch(normalize(url), { headers: { 'User-Agent': 'AIMAIL' } })
    if (!res.ok) throw new Error(`Adresse iCal inaccessible (${res.status}). Chez Google : Paramètres de l’agenda → « Adresse secrète au format iCal ».`)
    const text = await res.text()
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('Cette adresse ne renvoie pas un calendrier iCal.')
    const name = (text.match(/^X-WR-CALNAME:(.+)$/m)?.[1] ?? 'Agenda').trim()
    return { name, count: parseIcs(text).events.length }
  },
  async sync(cal: Calendar): Promise<void> {
    const res = await fetch(normalize(cal.url!), { headers: { 'User-Agent': 'AIMAIL' } })
    if (!res.ok) throw new Error(`${cal.name} : adresse iCal inaccessible (${res.status})`)
    const parsed = parseIcs(await res.text())
    const keep: string[] = []
    // les occurrences modifiées (RECURRENCE-ID) sont ignorées : le maître avec sa règle suffit à l'affichage
    for (const e of parsed.events) {
      if (!e.uid) continue
      const remoteId = e.uid
      const existing = CalendarRepo.byRemote(cal.id, remoteId)
      CalendarRepo.saveEvent({ id: existing?.id, calendarId: cal.id, uid: e.uid, summary: e.summary, description: e.description, location: e.location, start: e.start, end: e.end, allDay: e.allDay, rrule: e.rrule,
        organizer: e.organizer?.address ?? null, attendees: e.attendees, status: e.status, remoteId, etag: null, ics: null })
      keep.push(remoteId)
    }
    CalendarRepo.removeMissing(cal.id, keep)
  }
}