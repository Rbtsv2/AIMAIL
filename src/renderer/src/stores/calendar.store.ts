// src/renderer/src/stores/calendar.store.ts
import { create } from 'zustand'
import type { Calendar, CalEvent } from '@shared/models/Calendar'
import { invoke } from '@/lib/api'

export type Occ = CalEvent & { occStart: number; occEnd: number; color: string; calendarName: string }
export type ViewMode = 'month' | 'week' | 'agenda'

interface S {
  calendars: Calendar[]
  occ: Occ[]
  mode: ViewMode
  cursor: number
  range: { from: number; to: number }
  editing: Partial<CalEvent> | null
  load(): Promise<void>
  setMode(m: ViewMode): void
  go(delta: number): void
  today(): void
  setCursor(t: number): void
  refresh(): Promise<void>
  edit(e: Partial<CalEvent> | null): void
}

const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }
function rangeFor(mode: ViewMode, cursor: number): { from: number; to: number } {
  const d = new Date(cursor)
  if (mode === 'month') { const a = new Date(d.getFullYear(), d.getMonth(), 1); const b = new Date(d.getFullYear(), d.getMonth() + 1, 0); const fa = new Date(a); fa.setDate(a.getDate() - ((a.getDay() + 6) % 7)); const fb = new Date(b); fb.setDate(b.getDate() + (7 - ((b.getDay() + 6) % 7)) % 7); return { from: fa.getTime(), to: fb.getTime() + 86400_000 } }
  if (mode === 'week') { const a = new Date(startOfDay(cursor)); a.setDate(a.getDate() - ((a.getDay() + 6) % 7)); return { from: a.getTime(), to: a.getTime() + 7 * 86400_000 } }
  return { from: startOfDay(cursor), to: startOfDay(cursor) + 60 * 86400_000 }
}

export const useCalendar = create<S>((set, get) => ({
  calendars: [], occ: [], mode: 'month', cursor: Date.now(), range: rangeFor('month', Date.now()), editing: null,
  load: async () => { set({ calendars: await invoke('calendar:calendars') }); await get().refresh() },
  setMode: (mode) => { set({ mode, range: rangeFor(mode, get().cursor) }); void get().refresh() },
  go: (delta) => {
    const { mode, cursor } = get(); const d = new Date(cursor)
    if (mode === 'month') d.setMonth(d.getMonth() + delta); else if (mode === 'week') d.setDate(d.getDate() + 7 * delta); else d.setDate(d.getDate() + 30 * delta)
    set({ cursor: d.getTime(), range: rangeFor(mode, d.getTime()) }); void get().refresh()
  },
  today: () => { set({ cursor: Date.now(), range: rangeFor(get().mode, Date.now()) }); void get().refresh() },
  setCursor: (t) => { set({ cursor: t, range: rangeFor(get().mode, t) }); void get().refresh() },
  refresh: async () => { const { from, to } = get().range; set({ calendars: await invoke('calendar:calendars'), occ: await invoke('calendar:occurrences', from, to) }) },
  edit: (editing) => set({ editing })
}))