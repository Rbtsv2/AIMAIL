// src/renderer/src/features/calendar/CalendarPage.tsx
import { useEffect, useMemo, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Plus, RefreshCw, Trash2, Globe, Link2 } from 'lucide-react'
import type { Calendar, CaldavInput } from '@shared/models/Calendar'
import { useCalendar, type Occ } from '@/stores/calendar.store'
import { useAccounts } from '@/stores/accounts.store'
import { useUi } from '@/stores/ui.store'
import { invoke, on } from '@/lib/api'
import { IconButton } from '@/design-system/IconButton'
import { Segmented } from '@/design-system/Segmented'
import { Input } from '@/design-system/Field'

const DAYS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString()
const dayStart = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }
const hm = (t: number) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

function useOccByDay(occ: Occ[]): Map<string, Occ[]> {
  return useMemo(() => {
    const m = new Map<string, Occ[]>()
    for (const o of occ) {
      for (let t = dayStart(o.occStart); t < o.occEnd && t < o.occStart + 60 * 86400_000; t += 86400_000) { const k = new Date(t).toDateString(); const arr = m.get(k) ?? []; arr.push(o); m.set(k, arr) }
    }
    return m
  }, [occ])
}

function Pill({ o, onClick }: { o: Occ; onClick: () => void }) {
  return <button className="ev-pill" style={{ ['--c' as any]: o.color }} onClick={(e) => { e.stopPropagation(); onClick() }} title={`${o.summary}${o.location ? ' · ' + o.location : ''}`}>{!o.allDay && <span className="ev-time">{hm(o.occStart)}</span>}<span className="ev-txt">{o.summary || '(sans titre)'}</span></button>
}

export function CalendarPage() {
  const { calendars, occ, mode, cursor, range, setMode, go, today, edit, load, refresh } = useCalendar()
  const accounts = useAccounts((s) => s.accounts)
  const toast = useUi((s) => s.toast)
  const close = () => useUi.getState().setCalendar(false)
  const byDay = useOccByDay(occ)
  const [adding, setAdding] = useState<'none' | 'caldav'>('none')
  const [cd, setCd] = useState<CaldavInput>({ name: '', url: '', username: '', password: '', accountId: null })
  const [busy, setBusy] = useState(false)

  useEffect(() => { void load(); return on('calendar:changed', () => void refresh()) }, [])

  const openNew = (t: number, allDay = false) => edit({ start: t, end: t + (allDay ? 86400_000 : 3600_000), allDay })
  const openOcc = (o: Occ) => edit({ ...o })
  const sync = async () => { setBusy(true); try { const errs = await invoke('calendar:sync'); toast({ text: errs.length ? errs.join(' · ') : 'Agendas synchronisés', ttl: errs.length ? 8000 : 1800 }); await refresh() } finally { setBusy(false) } }
  const addGoogle = async (accountId: string) => { setBusy(true); try { const cals = await invoke('calendar:addGoogle', accountId); toast({ text: `${cals.length} agenda${cals.length > 1 ? 's' : ''} Google ajouté${cals.length > 1 ? 's' : ''}` }); await refresh() } catch (e: any) { toast({ text: String(e?.message ?? e).replace(/^Error invoking remote method '[^']+': Error: /, ''), ttl: 8000 }) } finally { setBusy(false) } }
  const addMicrosoft = async (accountId: string) => { setBusy(true); try { const cals = await invoke('calendar:addMicrosoft', accountId); toast({ text: `${cals.length} agenda${cals.length > 1 ? 's' : ''} Microsoft ajouté${cals.length > 1 ? 's' : ''}` }); await refresh() } catch (e: any) { toast({ text: String(e?.message ?? e).replace(/^Error invoking remote method '[^']+': Error: /, '').replace('GRAPH_NOT_AUTHORIZED', 'autorisation Microsoft requise'), ttl: 8000 }) } finally { setBusy(false) } }
  const addCaldav = async () => { setBusy(true); try { const cals = await invoke('calendar:addCaldav', cd); toast({ text: `${cals.length} agenda${cals.length > 1 ? 's' : ''} ajouté${cals.length > 1 ? 's' : ''}` }); setAdding('none'); setCd({ name: '', url: '', username: '', password: '', accountId: null }); await refresh() } catch (e: any) { toast({ text: String(e?.message ?? e).replace(/^Error invoking remote method '[^']+': Error: /, ''), ttl: 8000 }) } finally { setBusy(false) } }
  const toggleCal = async (c: Calendar) => { await invoke('calendar:saveCalendar', { ...c, enabled: !c.enabled }); await refresh() }
  const removeCal = async (c: Calendar) => { if (confirm(`Retirer l’agenda « ${c.name} » de l’application ?`)) { await invoke('calendar:removeCalendar', c.id); await refresh() } }

  const title = mode === 'month' ? new Date(cursor).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : mode === 'week' ? `${new Date(range.from).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${new Date(range.to - 1).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : 'Prochains événements'

  return (
    <section className="settings-page calendar">
      <div className="pane-head drag" style={{ justifyContent: 'flex-start', paddingLeft: 20, gap: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 'var(--fs-lg)', textTransform: 'capitalize', minWidth: 220 }}>{title}</span>
        <IconButton label="Précédent" onClick={() => go(-1)}><ChevronLeft size={16} /></IconButton>
        <IconButton label="Suivant" onClick={() => go(1)}><ChevronRight size={16} /></IconButton>
        <button className="btn quiet no-drag" onClick={today}>Aujourd’hui</button>
        <div style={{ flex: 1 }} />
        <div className="no-drag"><Segmented value={mode} options={[{ value: 'month', label: 'Mois' }, { value: 'week', label: 'Semaine' }, { value: 'agenda', label: 'Agenda' }]} onChange={setMode} /></div>
        <IconButton label="Synchroniser" onClick={() => void sync()}><RefreshCw size={16} className={busy ? 'spin' : ''} /></IconButton>
        <button className="btn primary no-drag" onClick={() => openNew(Date.now() + 3600_000 - (Date.now() % 1800_000))}><Plus size={14} /> Événement</button>
        <IconButton label="Fermer (Échap)" onClick={close}><X size={16} /></IconButton>
      </div>
      <div className="cal-body">
        <aside className="cal-side">
          <div className="cal-side-title">Agendas</div>
          {calendars.map((c) => (
            <div key={c.id} className="cal-item">
              <button className={`cal-check ${c.enabled ? 'on' : ''}`} style={{ ['--c' as any]: c.color }} onClick={() => void toggleCal(c)} aria-label={c.enabled ? 'Masquer' : 'Afficher'} />
              <span className="cal-name" title={c.url ?? c.remoteId ?? ''}>{c.name}</span>
              {c.kind !== 'local' && <button className="icon-btn" style={{ width: 22, height: 22 }} title="Retirer" onClick={() => void removeCal(c)}><Trash2 size={12} /></button>}
            </div>
          ))}
          <div className="cal-side-title" style={{ marginTop: 18 }}>Ajouter</div>
          {accounts.filter((a) => a.auth === 'oauth-google').map((a) => <button key={a.id} className="btn quiet" disabled={busy} style={{ justifyContent: 'flex-start', width: '100%' }} onClick={() => void addGoogle(a.id)}><Globe size={14} /> <span>Google <small>{a.email}</small></span></button>)}
          {accounts.filter((a) => a.auth === 'oauth-microsoft').map((a) => <button key={a.id} className="btn quiet" disabled={busy} style={{ justifyContent: 'flex-start', width: '100%' }} onClick={() => void addMicrosoft(a.id)}><Globe size={14} /> <span>Microsoft <small>{a.email}</small></span></button>)}
          <button className="btn quiet" style={{ justifyContent: 'flex-start', width: '100%' }} onClick={() => setAdding(adding === 'caldav' ? 'none' : 'caldav')}><Link2 size={14} /> <span>CalDAV <small>iCloud, OVH, Nextcloud…</small></span></button>
          {adding === 'caldav' && (
            <div className="form" style={{ marginTop: 8 }}>
              <Input placeholder="Adresse du serveur (ex. https://caldav.icloud.com)" value={cd.url} onChange={(e) => setCd({ ...cd, url: e.target.value })} />
              <Input placeholder="Identifiant" value={cd.username} onChange={(e) => setCd({ ...cd, username: e.target.value })} />
              <Input placeholder="Mot de passe (d’application pour iCloud)" type="password" value={cd.password} onChange={(e) => setCd({ ...cd, password: e.target.value })} />
              <button className="btn primary" disabled={busy || !cd.url || !cd.username} onClick={() => void addCaldav()}>{busy ? 'Recherche…' : 'Connecter'}</button>
            </div>
          )}
        </aside>
        <div className="cal-main">
          {mode === 'month' && <MonthView from={range.from} cursor={cursor} byDay={byDay} onDay={(t) => openNew(t + 9 * 3600_000)} onOcc={openOcc} />}
          {mode === 'week' && <WeekView from={range.from} byDay={byDay} occ={occ} onSlot={(t) => openNew(t)} onOcc={openOcc} />}
          {mode === 'agenda' && <AgendaView occ={occ} onOcc={openOcc} />}
        </div>
      </div>
    </section>
  )
}

function MonthView({ from, cursor, byDay, onDay, onOcc }: { from: number; cursor: number; byDay: Map<string, Occ[]>; onDay: (t: number) => void; onOcc: (o: Occ) => void }) {
  const month = new Date(cursor).getMonth()
  const cells = Array.from({ length: 42 }, (_, i) => from + i * 86400_000).filter((t, i) => i < 35 || new Date(t).getMonth() === month || new Date(from + 34 * 86400_000).getMonth() === month)
  return (
    <div className="month">
      {DAYS.map((d) => <div key={d} className="month-dow">{d}</div>)}
      {cells.map((t) => {
        const list = byDay.get(new Date(t).toDateString()) ?? []
        const d = new Date(t)
        return (
          <div key={t} className={`month-cell ${d.getMonth() !== month ? 'other' : ''} ${sameDay(t, Date.now()) ? 'today' : ''}`} onClick={() => onDay(t)}>
            <div className="month-num"><span>{d.getDate()}</span></div>
            {list.slice(0, 4).map((o) => <Pill key={`${o.id}-${o.occStart}`} o={o} onClick={() => onOcc(o)} />)}
            {list.length > 4 && <div className="ev-more">+{list.length - 4}</div>}
          </div>
        )
      })}
    </div>
  )
}

function WeekView({ from, byDay, occ, onSlot, onOcc }: { from: number; byDay: Map<string, Occ[]>; occ: Occ[]; onSlot: (t: number) => void; onOcc: (o: Occ) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => from + i * 86400_000)
  const H = 48
  const nowTop = ((Date.now() - dayStart(Date.now())) / 3600_000) * H
  return (
    <div className="week">
      <div className="week-head">
        <div className="week-gutter" />
        {days.map((t) => <div key={t} className={`week-day ${sameDay(t, Date.now()) ? 'today' : ''}`}><span className="wd-name">{DAYS[(new Date(t).getDay() + 6) % 7]}</span><span className="wd-num">{new Date(t).getDate()}</span>
          <div className="week-allday">{(byDay.get(new Date(t).toDateString()) ?? []).filter((o) => o.allDay).map((o) => <Pill key={`${o.id}-${o.occStart}`} o={o} onClick={() => onOcc(o)} />)}</div></div>)}
      </div>
      <div className="week-scroll">
        <div className="week-grid" style={{ height: 24 * H }}>
          <div className="week-gutter">{Array.from({ length: 24 }, (_, h) => <div key={h} className="week-hour" style={{ top: h * H }}>{h ? `${String(h).padStart(2, '0')}:00` : ''}</div>)}</div>
          {days.map((t) => (
            <div key={t} className="week-col" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const h = Math.floor(((e.clientY - r.top) / H) * 2) / 2; onSlot(t + h * 3600_000) }}>
              {Array.from({ length: 24 }, (_, h) => <div key={h} className="week-line" style={{ top: h * H }} />)}
              {sameDay(t, Date.now()) && <div className="week-now" style={{ top: nowTop }} />}
              {occ.filter((o) => !o.allDay && o.occStart < t + 86400_000 && o.occEnd > t).map((o) => {
                const s = Math.max(o.occStart, t), e = Math.min(o.occEnd, t + 86400_000)
                const top = ((s - t) / 3600_000) * H, height = Math.max(18, ((e - s) / 3600_000) * H - 2)
                return <button key={`${o.id}-${o.occStart}`} className="week-ev" style={{ top, height, ['--c' as any]: o.color }} onClick={(ev) => { ev.stopPropagation(); onOcc(o) }}><span className="ev-txt">{o.summary || '(sans titre)'}</span><span className="ev-sub">{hm(o.occStart)} – {hm(o.occEnd)}{o.location ? ' · ' + o.location : ''}</span></button>
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AgendaView({ occ, onOcc }: { occ: Occ[]; onOcc: (o: Occ) => void }) {
  const groups = useMemo(() => { const m = new Map<string, Occ[]>(); for (const o of occ.filter((x) => x.occEnd >= Date.now())) { const k = new Date(o.occStart).toDateString(); const a = m.get(k) ?? []; a.push(o); m.set(k, a) } return [...m.entries()] }, [occ])
  if (!groups.length) return <div className="empty"><div><h3>Rien de prévu</h3><p>Aucun événement dans les 60 prochains jours.</p></div></div>
  return (
    <div className="agenda">
      {groups.map(([k, list]) => (
        <div key={k} className="agenda-day">
          <div className={`agenda-date ${sameDay(list[0].occStart, Date.now()) ? 'today' : ''}`}><b>{new Date(list[0].occStart).getDate()}</b><span>{new Date(list[0].occStart).toLocaleDateString('fr-FR', { weekday: 'short', month: 'short' })}</span></div>
          <div className="agenda-list">
            {list.map((o) => <button key={`${o.id}-${o.occStart}`} className="agenda-ev" style={{ ['--c' as any]: o.color }} onClick={() => onOcc(o)}>
              <span className="agenda-time">{o.allDay ? 'Journée' : `${hm(o.occStart)} – ${hm(o.occEnd)}`}</span>
              <span className="ev-txt">{o.summary || '(sans titre)'}</span>
              <span className="ev-sub">{[o.location, o.calendarName].filter(Boolean).join(' · ')}</span>
            </button>)}
          </div>
        </div>
      ))}
    </div>
  )
}