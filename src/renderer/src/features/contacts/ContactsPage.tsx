// src/renderer/src/features/contacts/ContactsPage.tsx
import { useEffect, useMemo, useState } from 'react'
import { X, Search, Plus, Upload, Download, RefreshCw, Star, Trash2, Mail, Phone, Building2, Copy } from 'lucide-react'
import type { Contact, ContactInput } from '@shared/models/Contact'
import { invoke } from '@/lib/api'
import { useUi } from '@/stores/ui.store'
import { useAccounts } from '@/stores/accounts.store'
import { useCompose } from '@/stores/compose.store'
import { IconButton } from '@/design-system/IconButton'
import { Avatar } from '@/design-system/Avatar'
import { Input, TextArea, Row, Group } from '@/design-system/Field'

const blank = (): ContactInput => ({ accountId: null, firstName: '', lastName: '', displayName: '', emails: [''], phones: [''], org: '', title: '', notes: '', source: 'manual', googleId: null, starred: false })
const SOURCE: Record<string, string> = { manual: 'Saisi', import: 'Importé', google: 'Google', auto: 'Collecté' }

export function ContactsPage() {
  const close = () => useUi.getState().setContacts(false)
  const toast = useUi((s) => s.toast)
  const accounts = useAccounts((s) => s.accounts)
  const [q, setQ] = useState('')
  const [list, setList] = useState<Contact[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [edit, setEdit] = useState<ContactInput | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = async (query = q) => setList(await invoke('contacts:list', query))
  useEffect(() => { const t = setTimeout(() => void reload(q), 120); return () => clearTimeout(t) }, [q])
  useEffect(() => { void reload('') }, [])

  const current = useMemo(() => list.find((c) => c.id === selected) ?? null, [list, selected])
  const groups = useMemo(() => {
    const m = new Map<string, Contact[]>()
    for (const c of list) { const k = (c.displayName[0] ?? '#').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); const arr = m.get(/[A-Z]/.test(k) ? k : '#') ?? []; arr.push(c); m.set(/[A-Z]/.test(k) ? k : '#', arr) }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [list])

  const save = async () => {
    if (!edit) return
    const c = await invoke('contacts:save', { ...edit, emails: edit.emails.filter(Boolean), phones: edit.phones.filter(Boolean) })
    setEdit(null); await reload(); setSelected(c.id)
  }
  const remove = async (c: Contact) => { if (!confirm(`Supprimer ${c.displayName} ?`)) return; await invoke('contacts:delete', c.id); setSelected(null); await reload() }
  const doImport = async () => { setBusy(true); try { const r = await invoke('contacts:import'); if (r.imported + r.updated + r.skipped) toast({ text: `${r.imported} ajoutés, ${r.updated} mis à jour${r.skipped ? `, ${r.skipped} ignorés` : ''}`, ttl: 5000 }); await reload() } catch (e: any) { toast({ text: String(e?.message ?? e).replace(/^Error invoking remote method '[^']+': Error: /, ''), ttl: 7000 }) } finally { setBusy(false) } }
  const doExport = async (f: 'csv' | 'vcf') => { const p = await invoke('contacts:export', f); if (p) toast({ text: `Exporté : ${p}`, ttl: 5000 }) }
  const syncGoogle = async (accountId: string) => { setBusy(true); try { const r = await invoke('contacts:syncGoogle', accountId); toast({ text: `Google : ${r.imported} ajoutés, ${r.updated} mis à jour`, ttl: 5000 }); await reload() } catch (e: any) { toast({ text: String(e?.message ?? e).replace(/^Error invoking remote method '[^']+': Error: /, ''), ttl: 8000 }) } finally { setBusy(false) } }
  const write = (c: Contact, email: string) => { useCompose.getState().openNew(); setTimeout(() => useCompose.getState().update({ to: [{ name: c.displayName, address: email }] }), 50) }
  const copy = async (v: string) => { await navigator.clipboard.writeText(v); toast({ text: 'Copié', ttl: 1200 }) }
  const googleAccounts = accounts.filter((a) => a.googleData)

  return (
    <section className="settings-page contacts">
      <div className="pane-head drag" style={{ justifyContent: 'flex-start', paddingLeft: 20, gap: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 'var(--fs-lg)' }}>Contacts</span>
        <span style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)' }}>{list.length}</span>
        <div style={{ flex: 1 }} />
        <button className="btn quiet no-drag" disabled={busy} onClick={() => void doImport()}><Upload size={14} /> Importer</button>
        <button className="btn quiet no-drag" onClick={() => void doExport('csv')}><Download size={14} /> CSV</button>
        <button className="btn quiet no-drag" onClick={() => void doExport('vcf')}><Download size={14} /> vCard</button>
        {googleAccounts.map((a) => <button key={a.id} className="btn quiet no-drag" disabled={busy} title={a.email} onClick={() => void syncGoogle(a.id)}><RefreshCw size={14} /> Google</button>)}
        <button className="btn primary no-drag" onClick={() => { setEdit(blank()); setSelected(null) }}><Plus size={14} /> Nouveau</button>
        <IconButton label="Fermer (Échap)" onClick={close}><X size={16} /></IconButton>
      </div>
      <div className="contacts-body">
        <div className="contacts-list">
          <div className="list-search" style={{ margin: '10px 12px' }}><Search size={14} /><input autoFocus value={q} placeholder="Rechercher un nom, une adresse, une société" onChange={(e) => setQ(e.target.value)} /></div>
          <div className="contacts-scroll">
            {groups.map(([letter, cs]) => (
              <div key={letter}>
                <div className="contacts-letter">{letter}</div>
                {cs.map((c) => (
                  <button key={c.id} className={`contact-row ${selected === c.id ? 'on' : ''}`} onClick={() => { setSelected(c.id); setEdit(null) }}>
                    <Avatar who={{ name: c.displayName, address: c.emails[0] ?? c.displayName }} size={30} />
                    <span className="cr-text"><span className="cr-name">{c.displayName}{c.starred && <Star size={11} fill="currentColor" style={{ color: 'var(--warm)', marginLeft: 6 }} />}</span><span className="cr-sub">{c.emails[0] ?? c.phones[0] ?? c.org}</span></span>
                  </button>
                ))}
              </div>
            ))}
            {!list.length && <div className="empty" style={{ height: 240 }}><div><h3>Aucun contact</h3><p>Importez un carnet ou créez une fiche.</p></div></div>}
          </div>
        </div>
        <div className="contacts-detail">
          {edit ? (
            <div className="settings-pane" style={{ padding: 24 }}>
              <h2>{edit.id ? 'Modifier' : 'Nouveau contact'}</h2>
              <Group>
                <Row label="Prénom"><Input value={edit.firstName} onChange={(e) => setEdit({ ...edit, firstName: e.target.value })} /></Row>
                <Row label="Nom"><Input value={edit.lastName} onChange={(e) => setEdit({ ...edit, lastName: e.target.value })} /></Row>
                <Row label="Nom affiché" hint="Laissez vide pour « Prénom Nom »."><Input value={edit.displayName} onChange={(e) => setEdit({ ...edit, displayName: e.target.value })} /></Row>
                <Row label="Société"><Input value={edit.org} onChange={(e) => setEdit({ ...edit, org: e.target.value })} /></Row>
                <Row label="Fonction"><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Row>
              </Group>
              <Group>
                {edit.emails.map((v, i) => <Row key={`e${i}`} label={i === 0 ? 'E-mail' : ''}><Input type="email" value={v} placeholder="adresse@exemple.fr" onChange={(e) => { const emails = [...edit.emails]; emails[i] = e.target.value; setEdit({ ...edit, emails }) }} />{i === edit.emails.length - 1 && <button className="icon-btn" onClick={() => setEdit({ ...edit, emails: [...edit.emails, ''] })}><Plus size={14} /></button>}</Row>)}
                {edit.phones.map((v, i) => <Row key={`p${i}`} label={i === 0 ? 'Téléphone' : ''}><Input value={v} placeholder="+33 …" onChange={(e) => { const phones = [...edit.phones]; phones[i] = e.target.value; setEdit({ ...edit, phones }) }} />{i === edit.phones.length - 1 && <button className="icon-btn" onClick={() => setEdit({ ...edit, phones: [...edit.phones, ''] })}><Plus size={14} /></button>}</Row>)}
              </Group>
              <Group><Row column label="Notes"><TextArea value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Row></Group>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn quiet" onClick={() => setEdit(null)}>Annuler</button>
                <button className="btn primary" onClick={() => void save()}>Enregistrer</button>
              </div>
            </div>
          ) : current ? (
            <div className="contact-card">
              <div className="cc-head">
                <Avatar who={{ name: current.displayName, address: current.emails[0] ?? current.displayName }} size={56} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h2 className="sel">{current.displayName}</h2>
                  <div className="cc-sub">{[current.title, current.org].filter(Boolean).join(' · ') || SOURCE[current.source]}</div>
                </div>
                <IconButton label={current.starred ? 'Ne plus suivre' : 'Suivre'} on={current.starred} onClick={async () => { await invoke('contacts:save', { ...current, starred: !current.starred }); await reload() }}><Star size={16} fill={current.starred ? 'currentColor' : 'none'} /></IconButton>
                <button className="btn quiet" onClick={() => setEdit({ ...current, emails: current.emails.length ? current.emails : [''], phones: current.phones.length ? current.phones : [''] })}>Modifier</button>
                <IconButton label="Supprimer" onClick={() => void remove(current)}><Trash2 size={16} /></IconButton>
              </div>
              <Group>
                {current.emails.map((e) => <Row key={e} label=""><Mail size={15} style={{ color: 'var(--text-2)' }} /><span className="sel copy" style={{ flex: 1 }} onClick={() => void copy(e)}>{e}</span><button className="btn quiet" onClick={() => write(current, e)}>Écrire</button></Row>)}
                {current.phones.map((p) => <Row key={p} label=""><Phone size={15} style={{ color: 'var(--text-2)' }} /><span className="sel copy" style={{ flex: 1 }} onClick={() => void copy(p)}>{p}</span><button className="icon-btn" onClick={() => void copy(p)}><Copy size={14} /></button></Row>)}
                {current.org && <Row label=""><Building2 size={15} style={{ color: 'var(--text-2)' }} /><span className="sel">{current.org}</span></Row>}
              </Group>
              {current.notes && <Group><div className="frow sel" style={{ whiteSpace: 'pre-wrap' }}>{current.notes}</div></Group>}
              <div style={{ color: 'var(--text-3)', fontSize: 'var(--fs-xs)' }}>{SOURCE[current.source]} · mis à jour le {new Date(current.updatedAt).toLocaleDateString('fr-FR')}</div>
            </div>
          ) : (
            <div className="empty"><div><h3>Choisissez un contact</h3><p>Ou importez votre carnet : CSV, TSV, vCard, LDIF, SQLite ou Mork (Thunderbird).</p></div></div>
          )}
        </div>
      </div>
    </section>
  )
}