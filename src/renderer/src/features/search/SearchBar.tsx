// src/renderer/src/features/search/SearchBar.tsx
// Recherche + filtres avancés : chips (non lus, suivis, pièces jointes, catégorie, période) et opérateurs dans le texte
import { useState } from 'react'
import { Search, X, SlidersHorizontal, HelpCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useDebouncedSearch } from './useSearch'
import { useMail } from '@/stores/mail.store'
import { hasFilter, type ThreadFilter } from '@shared/search'

const CATS: { v: NonNullable<ThreadFilter['category']>; l: string }[] = [{ v: 'urgent', l: 'Urgent' }, { v: 'action', l: 'Action' }, { v: 'info', l: 'Info' }, { v: 'newsletter', l: 'Newsletter' }]
const PERIODS: { l: string; days: number }[] = [{ l: 'Aujourd’hui', days: 1 }, { l: '7 jours', days: 7 }, { l: '30 jours', days: 30 }, { l: 'Cette année', days: 0 }]

const toIso = (t?: number) => t ? new Date(t).toISOString().slice(0, 10) : ''
const startOf = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, 0, 0, 0).getTime() }
const endOf = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, 23, 59, 59).getTime() }

function sinceDays(days: number): number {
  const d = new Date()
  if (days === 0) return new Date(d.getFullYear(), 0, 1).getTime()
  d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (days - 1))
  return d.getTime()
}

export function SearchBar() {
  const [q, setQ] = useDebouncedSearch()
  const filter = useMail((s) => s.filter)
  const setFilter = useMail((s) => s.setFilter)
  const clearFilter = useMail((s) => s.clearFilter)
  const [open, setOpen] = useState(false)
  const [help, setHelp] = useState(false)
  const active = hasFilter(filter)
  const Chip = ({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) => <button className={`chip ${on ? 'on' : ''}`} onClick={onClick}>{label}</button>
  return (
    <div className="search-block">
      <div className="list-search no-drag">
        <Search size={14} />
        <input value={q} placeholder="Rechercher  —  de:  à:  objet:  après:  avant:  pj  nonlu" onChange={(e) => setQ(e.target.value)} />
        {q && <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => setQ('')}><X size={12} /></button>}
        <button className={`icon-btn ${open || active ? 'on' : ''}`} style={{ width: 24, height: 24 }} title="Filtres avancés" onClick={() => setOpen(!open)}><SlidersHorizontal size={13} />{active && <span className="dot-badge" />}</button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="filter-chips" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}>
            <div className="chips-row">
              <Chip on={!!filter.unread} label="Non lus" onClick={() => setFilter({ unread: !filter.unread })} />
              <Chip on={!!filter.starred} label="Suivis" onClick={() => setFilter({ starred: !filter.starred })} />
              <Chip on={!!filter.attachments} label="Pièces jointes" onClick={() => setFilter({ attachments: !filter.attachments })} />
              <span className="chips-sep" />
              {CATS.map((c) => <Chip key={c.v} on={filter.category === c.v} label={c.l} onClick={() => setFilter({ category: filter.category === c.v ? undefined : c.v })} />)}
              <span className="chips-sep" />
              {PERIODS.map((p) => { const v = sinceDays(p.days); return <Chip key={p.l} on={filter.after === v && !filter.before} label={p.l} onClick={() => setFilter({ after: filter.after === v ? undefined : v, before: undefined })} /> })}
              <span className="chips-sep" />
              <label className="chip date"><span>Du</span><input type="date" value={toIso(filter.after)} onChange={(e) => setFilter({ after: e.target.value ? startOf(e.target.value) : undefined })} /></label>
              <label className="chip date"><span>au</span><input type="date" value={toIso(filter.before)} onChange={(e) => setFilter({ before: e.target.value ? endOf(e.target.value) : undefined })} /></label>
              <span style={{ flex: 1 }} />
              {active && <button className="chip clear" onClick={() => { clearFilter() }}><X size={11} /> Effacer</button>}
              <button className={`icon-btn ${help ? 'on' : ''}`} style={{ width: 22, height: 22 }} title="Opérateurs de recherche" onClick={() => setHelp(!help)}><HelpCircle size={13} /></button>
            </div>
            {help && (
              <div className="search-help">
                <code>de:ducap</code> expéditeur · <code>à:contact@…</code> destinataire · <code>objet:facture</code> · <code>le:15/03/2026</code> jour précis · <code>après:2025-01</code> / <code>avant:15/03/2026</code> · <code>pj</code> pièce jointe · <code>nonlu</code> · <code>suivi</code> · <code>cat:urgent</code> · guillemets pour une expression exacte : <code>"convention d’honoraires"</code>. Les opérateurs cherchent dans toute la boîte ; le texte libre utilise l’index plein texte (corps, objet, pièces jointes).
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}