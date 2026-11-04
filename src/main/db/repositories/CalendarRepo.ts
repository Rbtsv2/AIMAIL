// src/main/db/repositories/CalendarRepo.ts
import { getDb, j, p, id } from '../index'
import type { Calendar, CalEvent, EventInput, Attendee } from '@shared/models/Calendar'

const calRow = (r: any): Calendar => ({ id: r.id, accountId: r.account_id, kind: r.kind, name: r.name, color: r.color, remoteId: r.remote_id, url: r.url, enabled: !!r.enabled, isDefault: !!r.is_default, readOnly: !!r.read_only })
const evRow = (r: any): CalEvent => ({
  id: r.id, calendarId: r.calendar_id, uid: r.uid, summary: r.summary, description: r.description, location: r.location, start: r.start, end: r.end, allDay: !!r.all_day,
  rrule: r.rrule, organizer: r.organizer, attendees: p<Attendee[]>(r.attendees_json, []), status: r.status, remoteId: r.remote_id, updatedAt: r.updated_at
})

export const CalendarRepo = {
  calendars(): Calendar[] { return getDb().prepare('SELECT * FROM calendars ORDER BY is_default DESC, created_at').all().map(calRow) },
  calendar(calId: string): Calendar | undefined { const r = getDb().prepare('SELECT * FROM calendars WHERE id = ?').get(calId); return r ? calRow(r) : undefined },
  defaultCalendar(): Calendar { return this.calendars().find((c) => c.isDefault && !c.readOnly) ?? this.calendars().find((c) => !c.readOnly) ?? this.calendars()[0] },
  saveCalendar(c: Partial<Calendar> & { kind: Calendar['kind']; name: string }): Calendar {
    const cid = c.id || id()
    const db = getDb()
    if (c.isDefault) db.prepare('UPDATE calendars SET is_default = 0').run()
    db.prepare(`INSERT INTO calendars(id,account_id,kind,name,color,remote_id,url,enabled,is_default,read_only,created_at) VALUES (@id,@acc,@kind,@name,@color,@remote,@url,@enabled,@def,@ro,@created)
      ON CONFLICT(id) DO UPDATE SET account_id=excluded.account_id, name=excluded.name, color=excluded.color, remote_id=excluded.remote_id, url=excluded.url, enabled=excluded.enabled, is_default=excluded.is_default, read_only=excluded.read_only`).run({
      id: cid, acc: c.accountId ?? null, kind: c.kind, name: c.name, color: c.color ?? '#4f6bed', remote: c.remoteId ?? null, url: c.url ?? null, enabled: c.enabled === false ? 0 : 1, def: c.isDefault ? 1 : 0, ro: c.readOnly ? 1 : 0, created: Date.now()
    })
    return this.calendar(cid)!
  },
  setCtag(calId: string, ctag: string | null): void { getDb().prepare('UPDATE calendars SET ctag = ? WHERE id = ?').run(ctag, calId) },
  ctag(calId: string): string | null { return (getDb().prepare('SELECT ctag FROM calendars WHERE id = ?').get(calId) as any)?.ctag ?? null },
  removeCalendar(calId: string): void { getDb().prepare('DELETE FROM calendars WHERE id = ?').run(calId) },

  events(calendarIds: string[], from: number, to: number): CalEvent[] {
    if (!calendarIds.length) return []
    const ph = calendarIds.map(() => '?').join(',')
    // les récurrents sont ramenés quel que soit leur début (expansion côté service)
    return getDb().prepare(`SELECT * FROM events WHERE calendar_id IN (${ph}) AND status != 'cancelled' AND (rrule IS NOT NULL OR ("end" >= ? AND start <= ?)) ORDER BY start`).all(...calendarIds, from, to).map(evRow)
  },
  event(eventId: string): CalEvent | undefined { const r = getDb().prepare('SELECT * FROM events WHERE id = ?').get(eventId); return r ? evRow(r) : undefined },
  byUid(uid: string, calendarId?: string): CalEvent | undefined {
    const r = calendarId ? getDb().prepare('SELECT * FROM events WHERE uid = ? AND calendar_id = ?').get(uid, calendarId) : getDb().prepare('SELECT * FROM events WHERE uid = ?').get(uid)
    return r ? evRow(r) : undefined
  },
  byRemote(calendarId: string, remoteId: string): CalEvent | undefined { const r = getDb().prepare('SELECT * FROM events WHERE calendar_id = ? AND remote_id = ?').get(calendarId, remoteId); return r ? evRow(r) : undefined },
  allInCalendar(calendarId: string): CalEvent[] { return getDb().prepare('SELECT * FROM events WHERE calendar_id = ?').all(calendarId).map(evRow) },
  saveEvent(e: EventInput & { remoteId?: string | null; etag?: string | null; ics?: string | null }): CalEvent {
    const eid = e.id || id()
    const uid = e.uid || `${eid}@mail.local`
    getDb().prepare(`INSERT INTO events(id,calendar_id,uid,summary,description,location,start,"end",all_day,rrule,organizer,attendees_json,status,remote_id,etag,ics,updated_at)
      VALUES (@id,@cal,@uid,@summary,@description,@location,@start,@end,@all_day,@rrule,@organizer,@attendees,@status,@remote,@etag,@ics,@updated)
      ON CONFLICT(id) DO UPDATE SET calendar_id=excluded.calendar_id, summary=excluded.summary, description=excluded.description, location=excluded.location, start=excluded.start, "end"=excluded."end",
        all_day=excluded.all_day, rrule=excluded.rrule, organizer=excluded.organizer, attendees_json=excluded.attendees_json, status=excluded.status, remote_id=COALESCE(excluded.remote_id, events.remote_id), etag=COALESCE(excluded.etag, events.etag), ics=COALESCE(excluded.ics, events.ics), updated_at=excluded.updated_at`).run({
      id: eid, cal: e.calendarId, uid, summary: e.summary, description: e.description, location: e.location, start: e.start, end: e.end, all_day: e.allDay ? 1 : 0, rrule: e.rrule, organizer: e.organizer,
      attendees: j(e.attendees), status: e.status, remote: e.remoteId ?? null, etag: e.etag ?? null, ics: e.ics ?? null, updated: Date.now()
    })
    return this.event(eid)!
  },
  etag(eventId: string): string | null { return (getDb().prepare('SELECT etag FROM events WHERE id = ?').get(eventId) as any)?.etag ?? null },
  removeEvent(eventId: string): void { getDb().prepare('DELETE FROM events WHERE id = ?').run(eventId) },
  removeMissing(calendarId: string, keepRemoteIds: string[]): void {
    const ph = keepRemoteIds.map(() => '?').join(',') || "''"
    getDb().prepare(`DELETE FROM events WHERE calendar_id = ? AND remote_id IS NOT NULL AND remote_id NOT IN (${ph})`).run(calendarId, ...keepRemoteIds)
  }
}