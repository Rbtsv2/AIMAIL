// src/renderer/src/features/calendar/EventEditor.tsx
import { useEffect, useMemo, useState } from 'react'
import { X, Trash2, MapPin, AlignLeft, Users, Repeat } from 'lucide-react'
import type { CalEvent, Attendee } from '@shared/models/Calendar'
import { invoke } from '@/lib/api'
import { useCalendar } from '@/stores/calendar.store'
import { useUi } from '@/stores/ui.store'
import { Input, TextArea, Select } from '@/design-system/Field'
import { Switch } from '@/design-system/Switch'
import { IconButton } from '@/design-system/IconButton'
import { parseAddresses, isEmail } from '@/lib/text'

const toLocal = (t: number) => { const d = new Date(t - new Date(t).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16) }
const toDate = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const RRULES = [{ v: '', l: 'Jamais' }, { v: 'FREQ=DAILY', l: 'Tous les jours' }, { v: 'FREQ=WEEKLY', l: 'Toutes les semaines' }, { v: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', l: 'Jours ouvrés' }, { v: 'FREQ=MONTHLY', l: 'Tous les mois' }, { v: 'FREQ=YEARLY', l: 'Tous les ans' }]

export function EventEditor() {
  const editing = useCalendar((s) => s.editing)
  const allCalendars = useCalendar((s) => s.calendars)
  const calendars = useMemo(() => allCalendars.filter((c) => !c.readOnly && c.enabled), [allCalendars])
  const close = () => useCalendar.getState().edit(null)
  const [e, setE] = useState<Partial<CalEvent>>({})
  const [att, setAtt] = useState('')
  const [busy, setBusy] = useState(false)
  const [places, setPlaces] = useState<{ label: string }[]>([])
  const [placeHi, setPlaceHi] = useState(0)
  const [placeQ, setPlaceQ] = useState<string | null>(null)
  useEffect(() => {
    if (placeQ === null || placeQ.trim().length < 3) { setPlaces([]); return }
    const t = setTimeout(() => void invoke('geo:suggest', placeQ).then((r) => { setPlaces(r); setPlaceHi(0) }), 250)
    return () => clearTimeout(t)
  }, [placeQ])
  useEffect(() => { if (editing) { setE({ calendarId: calendars.find((c) => c.isDefault)?.id ?? calendars[0]?.id, summary: '', description: '', location: '', allDay: false, rrule: null, attendees: [], status: 'confirmed', ...editing }); setAtt('') } }, [editing])
  if (!editing) return null
  const start = e.start ?? Date.now(), end = e.end ?? start + 3600_000
  const setStart = (t: number) => setE({ ...e, start: t, end: Math.max(t + (e.allDay ? 86400_000 : 1800_000), (e.end ?? 0) + (t - start)) })
  const save = async () => {
    if (!e.summary?.trim() || !e.calendarId) return
    setBusy(true)
    try {
      const attendees: Attendee[] = [...(e.attendees ?? []), ...parseAddresses(att).filter((a) => isEmail(a.address)).map((a) => ({ name: a.name, address: a.address, status: 'needs-action' as const }))]
      await invoke('calendar:saveEvent', { id: e.id, uid: e.uid, calendarId: e.calendarId, summary: e.summary.trim(), description: e.description ?? '', location: e.location ?? '', start, end, allDay: !!e.allDay, rrule: e.rrule || null, organizer: e.organizer ?? null, attendees, status: e.status ?? 'confirmed' })
      close(); await useCalendar.getState().refresh(); useUi.getState().toast({ text: 'Événement enregistré', ttl: 1800 })
    } catch (err: any) { useUi.getState().toast({ text: String(err?.message ?? err).replace(/^Error invoking remote method '[^']+': Error: /, ''), ttl: 7000 }) } finally { setBusy(false) }
  }
  const del = async () => { if (!e.id || !confirm('Supprimer cet événement ?')) return; await invoke('calendar:deleteEvent', e.id); close(); await useCalendar.getState().refresh() }
  return (
    <div className="confirm" onClick={close}>
      <div className="event-editor" onClick={(ev) => ev.stopPropagation()}>
        <div className="ee-head">
          <input className="ee-title" autoFocus placeholder="Titre de l’événement" value={e.summary ?? ''} onChange={(ev) => setE({ ...e, summary: ev.target.value })} onKeyDown={(ev) => { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) void save() }} />
          <IconButton label="Fermer" onClick={close}><X size={16} /></IconButton>
        </div>
        <div className="ee-row"><span className="ee-k">Agenda</span><Select value={e.calendarId} onChange={(ev) => setE({ ...e, calendarId: ev.target.value })}>{calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
        <div className="ee-row"><span className="ee-k">Journée entière</span><Switch on={!!e.allDay} onChange={(allDay) => setE({ ...e, allDay, start: allDay ? new Date(toDate(start)).getTime() : start, end: allDay ? new Date(toDate(start)).getTime() + 86400_000 : start + 3600_000 })} /></div>
        <div className="ee-row"><span className="ee-k">Début</span>{e.allDay ? <Input type="date" value={toDate(start)} onChange={(ev) => setStart(new Date(ev.target.value).getTime())} /> : <Input type="datetime-local" value={toLocal(start)} onChange={(ev) => setStart(new Date(ev.target.value).getTime())} />}</div>
        <div className="ee-row"><span className="ee-k">Fin</span>{e.allDay ? <Input type="date" value={toDate(end - 1)} onChange={(ev) => setE({ ...e, end: new Date(ev.target.value).getTime() + 86400_000 })} /> : <Input type="datetime-local" value={toLocal(end)} onChange={(ev) => setE({ ...e, end: new Date(ev.target.value).getTime() })} />}</div>
        <div className="ee-row"><span className="ee-k"><Repeat size={14} /></span><Select value={e.rrule ?? ''} onChange={(ev) => setE({ ...e, rrule: ev.target.value || null })}>{RRULES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}</Select></div>
        <div className="ee-row" style={{ position: 'relative' }}><span className="ee-k"><MapPin size={14} /></span>
          <Input placeholder="Lieu ou adresse" value={e.location ?? ''} style={{ flex: 1 }} autoComplete="off"
            onChange={(ev) => { setE({ ...e, location: ev.target.value }); setPlaceQ(ev.target.value) }}
            onBlur={() => setTimeout(() => setPlaces([]), 150)}
            onKeyDown={(ev) => {
              if (!places.length) return
              if (ev.key === 'ArrowDown') { ev.preventDefault(); setPlaceHi((h) => (h + 1) % places.length) }
              if (ev.key === 'ArrowUp') { ev.preventDefault(); setPlaceHi((h) => (h - 1 + places.length) % places.length) }
              if (ev.key === 'Enter' || ev.key === 'Tab') { ev.preventDefault(); setE({ ...e, location: places[placeHi].label }); setPlaces([]); setPlaceQ(null) }
              if (ev.key === 'Escape') setPlaces([])
            }} />
          {places.length > 0 && <div className="sugg" style={{ left: 120, right: 0, minWidth: 0, maxWidth: 'none' }} onMouseDown={(ev) => ev.preventDefault()}>
            {places.map((p, i) => <button key={p.label} className={i === placeHi ? 'on' : ''} onMouseEnter={() => setPlaceHi(i)} onClick={() => { setE({ ...e, location: p.label }); setPlaces([]); setPlaceQ(null) }}><MapPin size={12} style={{ flex: 'none', alignSelf: 'center' }} /><span className="s-name">{p.label}</span></button>)}
          </div>}
        </div>
        <div className="ee-row"><span className="ee-k"><Users size={14} /></span><div style={{ flex: 1 }}>
          {(e.attendees ?? []).length > 0 && <div className="chips" style={{ marginBottom: 6 }}>{e.attendees!.map((a) => <span key={a.address} className={`chip att-${a.status}`} title={a.status}>{a.name || a.address}<button onClick={() => setE({ ...e, attendees: e.attendees!.filter((x) => x.address !== a.address) })}><X size={11} /></button></span>)}</div>}
          <Input placeholder="Invités (adresses séparées par des virgules)" value={att} onChange={(ev) => setAtt(ev.target.value)} style={{ width: '100%' }} />
        </div></div>
        <div className="ee-row" style={{ alignItems: 'flex-start' }}><span className="ee-k"><AlignLeft size={14} /></span><TextArea placeholder="Notes" value={e.description ?? ''} onChange={(ev) => setE({ ...e, description: ev.target.value })} style={{ minHeight: 70 }} /></div>
        <div className="ee-foot">
          {e.id && <button className="btn danger" onClick={() => void del()}><Trash2 size={14} /> Supprimer</button>}
          <div style={{ flex: 1 }} />
          <button className="btn quiet" onClick={close}>Annuler</button>
          <button className="btn primary" disabled={busy || !e.summary?.trim()} onClick={() => void save()}>{e.id ? 'Enregistrer' : 'Créer'}</button>
        </div>
      </div>
    </div>
  )
}