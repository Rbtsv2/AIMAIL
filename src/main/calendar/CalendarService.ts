// src/main/calendar/CalendarService.ts
import type { Calendar, CalEvent, EventInput, Invitation, Attendee, CaldavInput } from '@shared/models/Calendar'
import { CalendarRepo } from '../db/repositories/CalendarRepo'
import { AccountRepo } from '../db/repositories/AccountRepo'
import { MessageRepo } from '../db/repositories/MessageRepo'
import { Credentials } from '../auth/Credentials'
import { GoogleCalendar } from './GoogleCalendar'
import { CalDav } from './CalDav'
import { IcsSubscription } from './IcsSubscription'
import { MicrosoftCalendar } from './MicrosoftCalendar'
import { graphAuthorize, hasGraph } from '../auth/oauth/microsoftGraph'
import { expand, parseIcs, buildIcs } from './ical'
import { events as bus } from '../sync/events'
import { log } from '../utils/logger'
import { readFileSync } from 'fs'
import { sendMail } from '../smtp/Sender'

export interface Occurrence extends CalEvent { occStart: number; occEnd: number; color: string; calendarName: string }

export const CalendarService = {
  calendars(): Calendar[] { return CalendarRepo.calendars() },

  occurrences(from: number, to: number): Occurrence[] {
    const cals = CalendarRepo.calendars().filter((c) => c.enabled)
    const byId = new Map(cals.map((c) => [c.id, c]))
    const out: Occurrence[] = []
    for (const e of CalendarRepo.events(cals.map((c) => c.id), from, to)) {
      const cal = byId.get(e.calendarId)!
      for (const o of expand(e, from, to)) out.push({ ...e, occStart: o.start, occEnd: o.end, color: cal.color, calendarName: cal.name })
    }
    return out.sort((a, b) => a.occStart - b.occStart)
  },

  async saveEvent(e: EventInput): Promise<CalEvent> {
    const cal = CalendarRepo.calendar(e.calendarId)
    if (!cal) throw new Error('agenda introuvable')
    if (cal.readOnly) throw new Error('cet agenda est en lecture seule')
    const existing = e.id ? CalendarRepo.event(e.id) : undefined
    let saved: CalEvent
    if (cal.kind === 'google') { const a = AccountRepo.get(cal.accountId!)!; saved = existing?.remoteId ? await GoogleCalendar.update(a, cal, existing, e) : await GoogleCalendar.create(a, cal, e) }
    else if (cal.kind === 'microsoft') { const a = AccountRepo.get(cal.accountId!)!; saved = existing?.remoteId ? await MicrosoftCalendar.update(a, cal, existing, e) : await MicrosoftCalendar.create(a, cal, e) }
    else if (cal.kind === 'caldav') saved = await CalDav.put(cal, e, existing)
    else saved = CalendarRepo.saveEvent(e)
    bus.emitEvent('calendar:changed', {})
    return saved
  },

  async deleteEvent(eventId: string): Promise<void> {
    const ev = CalendarRepo.event(eventId)
    if (!ev) return
    const cal = CalendarRepo.calendar(ev.calendarId)!
    if (cal.kind === 'google' && ev.remoteId) await GoogleCalendar.remove(AccountRepo.get(cal.accountId!)!, cal, ev)
    else if (cal.kind === 'microsoft' && ev.remoteId) await MicrosoftCalendar.remove(AccountRepo.get(cal.accountId!)!, cal, ev)
    else if (cal.kind === 'caldav' && ev.remoteId) await CalDav.remove(cal, ev)
    else CalendarRepo.removeEvent(ev.id)
    bus.emitEvent('calendar:changed', {})
  },

  async addGoogle(accountId: string): Promise<Calendar[]> {
    const a = AccountRepo.get(accountId)
    if (!a || a.auth !== 'oauth-google') throw new Error('compte Google requis')
    const cals = await GoogleCalendar.discover(a)
    await this.sync()
    return cals
  },

  async addMicrosoft(accountId: string): Promise<Calendar[]> {
    const a = AccountRepo.get(accountId)
    if (!a || a.auth !== 'oauth-microsoft') throw new Error('compte Microsoft requis')
    if (!hasGraph(a.id)) await graphAuthorize(a.id, a.email)
    const cals = await MicrosoftCalendar.discover(a)
    await this.sync()
    return cals
  },

  async addCaldav(input: CaldavInput): Promise<Calendar[]> {
    const cals = await CalDav.discover(input)
    await this.sync()
    return cals
  },

  async addIcs(input: { url: string; name?: string; color?: string }): Promise<Calendar> {
    const p = await IcsSubscription.probe(input.url)
    const cal = CalendarRepo.saveCalendar({ kind: 'ics', name: input.name?.trim() || p.name, color: input.color ?? '#0a84ff', url: input.url.trim(), accountId: null, remoteId: null, enabled: true, isDefault: false, readOnly: true })
    await IcsSubscription.sync(cal)
    bus.emitEvent('calendar:changed', {})
    return cal
  },

  async removeCalendar(calId: string): Promise<void> {
    CalendarRepo.removeCalendar(calId)
    Credentials.remove(`caldav:${calId}`)
    bus.emitEvent('calendar:changed', {})
  },

  syncing: false,
  async sync(): Promise<string[]> {
    if (this.syncing) return []
    this.syncing = true
    const errors: string[] = []
    const from = Date.now() - 180 * 86400_000, to = Date.now() + 365 * 86400_000
    try {
      for (const cal of CalendarRepo.calendars().filter((c) => c.enabled)) {
        try {
          if (cal.kind === 'google') await GoogleCalendar.sync(AccountRepo.get(cal.accountId!)!, cal, from, to)
          else if (cal.kind === 'caldav') await CalDav.sync(cal, from, to)
          else if (cal.kind === 'ics') await IcsSubscription.sync(cal)
          else if (cal.kind === 'microsoft') await MicrosoftCalendar.sync(AccountRepo.get(cal.accountId!)!, cal, from, to)
        } catch (e: any) { log.warn('calendar', cal.name, e?.message ?? e); errors.push(`${cal.name} : ${e?.message ?? e}`) }
      }
    } finally { this.syncing = false }
    bus.emitEvent('calendar:changed', {})
    return errors
  },

  // ---- invitations reçues par mail
  invitationFromMessage(messageId: string): Invitation | null {
    const m = MessageRepo.get(messageId)
    if (!m) return null
    const att = m.attachments.find((a) => /text\/calendar|application\/ics/i.test(a.mimeType) || /\.ics$/i.test(a.filename))
    if (!att?.localPath) return null
    let text: string
    try { text = readFileSync(att.localPath, 'utf8') } catch { return null }
    const parsed = parseIcs(text)
    const ev = parsed.events[0]
    if (!ev) return null
    const account = AccountRepo.get(m.accountId)
    const me = account?.email.toLowerCase()
    const mine = ev.attendees.find((a) => a.address === me)
    const method = (parsed.method ?? 'PUBLISH') as Invitation['method']
    return { method: ['REQUEST', 'CANCEL', 'REPLY', 'PUBLISH'].includes(method) ? method : 'PUBLISH', uid: ev.uid, summary: ev.summary, description: ev.description, location: ev.location, start: ev.start, end: ev.end, allDay: ev.allDay,
      organizer: ev.organizer, attendees: ev.attendees, myStatus: mine?.status ?? null, alreadyInCalendar: !!CalendarRepo.byUid(ev.uid) }
  },

  async respond(messageId: string, status: 'accepted' | 'declined' | 'tentative'): Promise<void> {
    const inv = this.invitationFromMessage(messageId)
    const m = MessageRepo.get(messageId)
    if (!inv || !m) throw new Error('invitation introuvable')
    const account = AccountRepo.get(m.accountId)!
    // 1. agenda local (ou par défaut) : ajout / mise à jour / suppression si refus
    const cal = CalendarRepo.defaultCalendar()
    const existing = CalendarRepo.byUid(inv.uid)
    const attendees: Attendee[] = inv.attendees.map((a) => (a.address === account.email.toLowerCase() ? { ...a, status } : a))
    if (status === 'declined') { if (existing) await this.deleteEvent(existing.id) }
    else await this.saveEvent({ id: existing?.id, calendarId: existing?.calendarId ?? cal.id, uid: inv.uid, summary: inv.summary, description: inv.description, location: inv.location, start: inv.start, end: inv.end, allDay: inv.allDay, rrule: null, organizer: inv.organizer?.address ?? null, attendees, status: status === 'tentative' ? 'tentative' : 'confirmed' })
    // 2. réponse iTIP à l'organisateur
    if (inv.organizer?.address && inv.method === 'REQUEST') {
      const partstat = status.toUpperCase()
      const ics = buildIcs({ uid: inv.uid, summary: inv.summary, description: '', location: inv.location, start: inv.start, end: inv.end, allDay: inv.allDay, rrule: null, organizer: inv.organizer, attendees: [{ name: account.name, address: account.email, status }] }, { method: 'REPLY' })
      const label = { accepted: 'Accepté', declined: 'Refusé', tentative: 'Peut-être' }[status]
      await sendMail(account, {
        from: `"${account.name}" <${account.email}>`, to: inv.organizer.address, subject: `${label} : ${inv.summary}`,
        text: `${account.name} a répondu « ${label.toLowerCase()} » à l’invitation « ${inv.summary} ».`,
        alternatives: [{ contentType: `text/calendar; method=REPLY; charset=UTF-8`, content: ics }],
        attachments: [{ filename: 'invite.ics', content: ics, contentType: `text/calendar; method=REPLY` }],
        inReplyTo: m.messageId, references: [...m.references, m.messageId].join(' ')
      })
      void partstat
    }
    bus.emitEvent('calendar:changed', {})
  }
}