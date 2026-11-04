// src/renderer/src/features/thread/InvitationCard.tsx
import { useEffect, useState } from 'react'
import { CalendarDays, MapPin, Check, X, HelpCircle } from 'lucide-react'
import type { Invitation } from '@shared/models/Calendar'
import { invoke } from '@/lib/api'
import { useUi } from '@/stores/ui.store'

const fmt = (inv: Invitation) => {
  const s = new Date(inv.start), e = new Date(inv.end)
  if (inv.allDay) { const d = s.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); const days = Math.round((inv.end - inv.start) / 86400_000); return days > 1 ? `${d} → ${new Date(inv.end - 1).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` : d }
  return `${s.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · ${s.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} – ${e.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}
const LABEL: Record<string, string> = { accepted: 'Accepté', declined: 'Refusé', tentative: 'Peut-être', 'needs-action': 'En attente' }

export function InvitationCard({ messageId }: { messageId: string }) {
  const [inv, setInv] = useState<Invitation | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => { let alive = true; void invoke('calendar:invitation', messageId).then((r) => { if (alive) setInv(r) }); return () => { alive = false } }, [messageId])
  if (!inv) return null
  const respond = async (status: 'accepted' | 'declined' | 'tentative') => {
    setBusy(status)
    try { await invoke('calendar:respond', messageId, status); setInv({ ...inv, myStatus: status, alreadyInCalendar: status !== 'declined' }); useUi.getState().toast({ text: status === 'declined' ? 'Invitation refusée' : 'Ajouté à votre agenda, réponse envoyée', ttl: 2500 }) }
    catch (e: any) { useUi.getState().toast({ text: String(e?.message ?? e).replace(/^Error invoking remote method '[^']+': Error: /, ''), ttl: 7000 }) }
    finally { setBusy(null) }
  }
  return (
    <div className={`invite ${inv.method === 'CANCEL' ? 'cancel' : ''}`}>
      <div className="invite-icon"><CalendarDays size={18} /></div>
      <div className="invite-body">
        <div className="invite-title">{inv.method === 'CANCEL' ? 'Événement annulé : ' : inv.method === 'REPLY' ? 'Réponse à votre invitation : ' : ''}{inv.summary || '(sans titre)'}</div>
        <div className="invite-when">{fmt(inv)}</div>
        {inv.location && <div className="invite-sub"><MapPin size={12} /> {inv.location}</div>}
        {inv.organizer && <div className="invite-sub">Organisé par {inv.organizer.name || inv.organizer.address}</div>}
        {inv.method === 'REQUEST' && (
          <div className="invite-actions">
            <button className={`btn ${inv.myStatus === 'accepted' ? 'primary' : 'quiet'}`} disabled={!!busy} onClick={() => void respond('accepted')}><Check size={14} /> Accepter</button>
            <button className={`btn ${inv.myStatus === 'tentative' ? 'primary' : 'quiet'}`} disabled={!!busy} onClick={() => void respond('tentative')}><HelpCircle size={14} /> Peut-être</button>
            <button className={`btn ${inv.myStatus === 'declined' ? 'danger' : 'quiet'}`} disabled={!!busy} onClick={() => void respond('declined')}><X size={14} /> Refuser</button>
            {inv.myStatus && inv.myStatus !== 'needs-action' && <span className="invite-status">{LABEL[inv.myStatus]}{inv.alreadyInCalendar ? ' · dans votre agenda' : ''}</span>}
          </div>
        )}
        {inv.method === 'REPLY' && inv.attendees[0] && <div className="invite-sub">{inv.attendees[0].name || inv.attendees[0].address} : <b>{LABEL[inv.attendees[0].status]}</b></div>}
      </div>
    </div>
  )
}