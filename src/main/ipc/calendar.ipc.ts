// src/main/ipc/calendar.ipc.ts
import { handle } from './index'
import { CalendarService } from '../calendar/CalendarService'
import { CalendarRepo } from '../db/repositories/CalendarRepo'
import { suggestPlaces } from '../calendar/geocode'

export function registerCalendarIpc(): void {
  handle('calendar:calendars', () => CalendarService.calendars())
  handle('calendar:saveCalendar', (c) => { const r = CalendarRepo.saveCalendar(c as any); return r })
  handle('calendar:removeCalendar', (id) => CalendarService.removeCalendar(id))
  handle('calendar:occurrences', (from, to) => CalendarService.occurrences(from, to))
  handle('calendar:saveEvent', (e) => CalendarService.saveEvent(e))
  handle('calendar:deleteEvent', (id) => CalendarService.deleteEvent(id))
  handle('calendar:sync', () => CalendarService.sync())
  handle('calendar:addGoogle', (accountId) => CalendarService.addGoogle(accountId))
  handle('calendar:addCaldav', (input) => CalendarService.addCaldav(input))
  handle('calendar:addMicrosoft', (accountId) => CalendarService.addMicrosoft(accountId))
  handle('calendar:invitation', (messageId) => CalendarService.invitationFromMessage(messageId))
  handle('calendar:respond', (messageId, status) => CalendarService.respond(messageId, status))
  handle('geo:suggest', (q) => suggestPlaces(q))
}