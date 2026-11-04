// src/renderer/src/features/thread/EventSuggestion.tsx
import { useEffect, useState } from 'react'
import { CalendarPlus, MapPin, Sparkles } from 'lucide-react'
import type { DetectedEvent } from '@shared/ipc'
import { invoke } from '@/lib/api'
import { useCalendar } from '@/stores/calendar.store'
import { useAi } from '@/stores/ai.store'

const fmt = (e: DetectedEvent) => {
  const s = new Date(e.start)
  const d = s.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return e.allDay ? d : `${d} · ${s.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

export function EventSuggestion({ messageId }: { messageId: string }) {
  const enabled = useAi((s) => s.settings?.enabled && s.settings.detectEvents)
  const [ev, setEv] = useState<DetectedEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => { if (!enabled) return; let alive = true; void invoke('ai:extractEvent', messageId).then((r) => { if (alive) setEv(r) }).catch(() => {}); return () => { alive = false } }, [messageId, enabled])
  if (!ev || dismissed) return null
  const add = async () => {
    const cals = await invoke('calendar:calendars')
    const cal = cals.find((c) => c.isDefault && !c.readOnly) ?? cals.find((c) => !c.readOnly)
    useCalendar.getState().edit({ calendarId: cal?.id, summary: ev.summary, start: ev.start, end: ev.end, allDay: ev.allDay, location: ev.location, description: '' })
  }
  return (
    <div className="invite suggest">
      <div className="invite-icon"><Sparkles size={16} /></div>
      <div className="invite-body">
        <div className="invite-title">{ev.summary}</div>
        <div className="invite-when">{fmt(ev)}</div>
        {ev.location && <div className="invite-sub"><MapPin size={12} /> {ev.location}</div>}
        <div className="invite-actions">
          <button className="btn primary" onClick={() => void add()}><CalendarPlus size={14} /> Ajouter à l’agenda</button>
          <button className="btn quiet" onClick={() => setDismissed(true)}>Ignorer</button>
          <span className="invite-status">Détecté par l’assistant{ev.confidence === 'medium' ? ' · à vérifier' : ''}</span>
        </div>
      </div>
    </div>
  )
}