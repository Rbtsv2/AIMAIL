// src/shared/models/Calendar.ts
export type CalendarKind = 'local' | 'google' | 'caldav' | 'microsoft'

export interface Calendar {
  id: string
  accountId: string | null
  kind: CalendarKind
  name: string
  color: string
  remoteId: string | null
  url: string | null
  enabled: boolean
  isDefault: boolean
  readOnly: boolean
}

export interface Attendee { name: string; address: string; status: 'needs-action' | 'accepted' | 'declined' | 'tentative' }

export interface CalEvent {
  id: string
  calendarId: string
  uid: string
  summary: string
  description: string
  location: string
  start: number
  end: number
  allDay: boolean
  rrule: string | null
  organizer: string | null
  attendees: Attendee[]
  status: 'confirmed' | 'tentative' | 'cancelled'
  remoteId: string | null
  updatedAt: number
}

export interface EventInput extends Omit<CalEvent, 'id' | 'uid' | 'remoteId' | 'updatedAt'> { id?: string; uid?: string }

export interface Invitation {
  method: 'REQUEST' | 'CANCEL' | 'REPLY' | 'PUBLISH'
  uid: string
  summary: string
  description: string
  location: string
  start: number
  end: number
  allDay: boolean
  organizer: { name: string; address: string } | null
  attendees: Attendee[]
  myStatus: Attendee['status'] | null
  alreadyInCalendar: boolean
}

export interface CaldavInput { name: string; url: string; username: string; password: string; accountId: string | null }