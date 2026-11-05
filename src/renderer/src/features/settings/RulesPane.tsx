// src/renderer/src/features/settings/RulesPane.tsx
// Règles de tri (conditions → actions) et rétention par dossier.
import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Play, ChevronUp, ChevronDown, GripVertical, Search, X } from 'lucide-react'
import { Group, Row, Select, Input as TextInput } from '@/design-system/Field'
import { Switch } from '@/design-system/Switch'
import { invoke } from '@/lib/api'
import { useAccounts } from '@/stores/accounts.store'
import { useUi } from '@/stores/ui.store'
import type { Rule, RuleAction, RuleField, RuleOp } from '@shared/models/Rule'
import type { Folder } from '@shared/models/Folder'

const FIELDS: { v: RuleField; l: string }[] = [{ v: 'from', l: 'Expéditeur' }, { v: 'to', l: 'Destinataire' }, { v: 'subject', l: 'Objet' }, { v: 'body', l: 'Contenu' }, { v: 'attachment', l: 'Pièce jointe' }, { v: 'category', l: 'Catégorie IA' }]
const OPS: Record<RuleField, { v: RuleOp; l: string }[]> = {
  from: [{ v: 'contains', l: 'contient' }, { v: 'notContains', l: 'ne contient pas' }, { v: 'is', l: 'est' }, { v: 'endsWith', l: 'se termine par' }],
  to: [{ v: 'contains', l: 'contient' }, { v: 'notContains', l: 'ne contient pas' }, { v: 'is', l: 'est' }],
  subject: [{ v: 'contains', l: 'contient' }, { v: 'notContains', l: 'ne contient pas' }, { v: 'startsWith', l: 'commence par' }, { v: 'equals', l: 'est exactement' }],
  body: [{ v: 'contains', l: 'contient' }, { v: 'notContains', l: 'ne contient pas' }],
  attachment: [{ v: 'is', l: 'présente' }, { v: 'isNot', l: 'absente' }, { v: 'contains', l: 'nom contient' }],
  category: [{ v: 'is', l: 'est' }, { v: 'isNot', l: 'n’est pas' }],
  account: [{ v: 'is', l: 'est' }]
}
const CATS = [{ v: 'urgent', l: 'Urgent' }, { v: 'action', l: 'Action' }, { v: 'info', l: 'Information' }, { v: 'newsletter', l: 'Newsletter' }, { v: 'spam', l: 'Spam' }]
const ACTIONS: { v: RuleAction['type']; l: string }[] = [{ v: 'move', l: 'Déplacer vers le dossier' }, { v: 'markRead', l: 'Marquer comme lu' }, { v: 'star', l: 'Suivre (étoile)' }, { v: 'category', l: 'Attribuer la catégorie' }, { v: 'spam', l: 'Mettre dans Indésirables' }, { v: 'trash', l: 'Mettre à la Corbeille' }, { v: 'inbox', l: 'Remettre en Réception' }]
const RETENTION = [{ v: '', l: 'Jamais' }, { v: '7', l: 'Après 7 jours' }, { v: '14', l: 'Après 14 jours' }, { v: '30', l: 'Après 30 jours' }, { v: '90', l: 'Après 90 jours' }, { v: '180', l: 'Après 6 mois' }, { v: '365', l: 'Après 1 an' }]

// champ expéditeur / destinataire : suggestions depuis les contacts et les adresses collectées
function AddressInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [sugg, setSugg] = useState<{ name: string; address: string }[]>([])
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const q = value.trim()
    if (q.length < 2) { setSugg([]); return }
    let on = true
    const t = setTimeout(() => void invoke('contacts:suggest', q).then((r) => { if (on) setSugg(r.slice(0, 8)) }), 120)
    return () => { on = false; clearTimeout(t) }
  }, [value])
  return (
    <div className="addr-input">
      <TextInput value={value} placeholder={placeholder} onChange={(e) => { onChange(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && sugg.length > 0 && (
        <div className="addr-sugg">
          {sugg.map((x) => <button key={x.address} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(x.address); setOpen(false) }}><span className="n">{x.name || x.address}</span>{x.name && <span className="a">{x.address}</span>}</button>)}
          <button type="button" className="dom" onMouseDown={(e) => e.preventDefault()} onClick={() => { const d = (sugg[0]?.address.split('@')[1] ?? ''); if (d) { onChange('@' + d); setOpen(false) } }}>Tout le domaine @{sugg[0]?.address.split('@')[1]}</button>
        </div>
      )}
    </div>
  )
}

const newRule = (accountId: string | null): Rule => ({ id: '', name: 'Nouvelle règle', enabled: true, sortOrder: 999, accountId, match: 'all', conditions: [{ field: 'from', op: 'contains', value: '' }], actions: [{ type: 'move', folderId: '' }], stop: true, scope: 'inbox', createdAt: 0 })
const leafOf = (f: Folder) => f.path.split(f.delimiter).pop() ?? f.name

export function RulesPane() {
  const accounts = useAccounts((s) => s.accounts)
  const folders = useAccounts((s) => s.folders)
  const [rules, setRules] = useState<Rule[]>([])
  const [edit, setEdit] = useState<Rule | null>(null)
  const [retQuery, setRetQuery] = useState('')
  const load = () => void invoke('rules:list').then(setRules)
  useEffect(load, [])
  // brouillon venu d'un message (« Créer une règle pour cet expéditeur »)
  const draft = useUi((s) => s.ruleDraft)
  useEffect(() => {
    if (!draft) return
    setEdit({ ...newRule(draft.accountId), name: `Mails de ${draft.name}`, conditions: [{ field: 'from', op: 'contains', value: draft.from }] })
    useUi.setState({ ruleDraft: null })
  }, [draft])
  const foldersFor = (accountId: string | null) => (accountId ? [accountId] : accounts.map((a) => a.id)).flatMap((aid) => (folders[aid] ?? []).filter((f) => !f.noselect && !f.id.startsWith('virtual:') && f.role !== 'drafts' && f.role !== 'sent').map((f) => ({ f, email: accounts.find((a) => a.id === aid)?.email ?? '' })))
  const save = async () => {
    if (!edit) return
    const r = await invoke('rules:save', { ...edit, conditions: edit.conditions.filter((c) => c.value.trim() || c.field === 'attachment'), actions: edit.actions.filter((a) => a.type !== 'move' || a.folderId) })
    setEdit(null); load(); useUi.getState().toast({ text: `Règle « ${r.name} » enregistrée` })
  }
  const run = async (rule?: Rule) => {
    useUi.getState().toast({ text: 'Application des règles aux messages des 30 derniers jours…' })
    const r = await invoke('rules:run', { ruleId: rule?.id })
    useUi.getState().toast({ text: `${r.touched} message${r.touched > 1 ? 's' : ''} concerné${r.touched > 1 ? 's' : ''}, ${r.moved} déplacé${r.moved > 1 ? 's' : ''}` })
  }
  const move = async (i: number, dir: -1 | 1) => { const ids = rules.map((r) => r.id); const j = i + dir; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; await invoke('rules:reorder', ids); load() }
  const describe = (r: Rule) => {
    const c = r.conditions.map((x) => `${FIELDS.find((f) => f.v === x.field)?.l ?? x.field} ${OPS[x.field]?.find((o) => o.v === x.op)?.l ?? x.op}${x.field === 'attachment' && (x.op === 'is' || x.op === 'isNot') ? '' : ` « ${x.value} »`}`).join(r.match === 'any' ? ' ou ' : ' et ')
    const a = r.actions.map((x) => x.type === 'move' ? `→ ${(() => { const f = Object.values(folders).flat().find((y) => y.id === x.folderId); return f ? leafOf(f) : '?' })()}` : x.type === 'category' ? `catégorie ${x.value}` : ACTIONS.find((y) => y.v === x.type)?.l.toLowerCase()).join(', ')
    return `${c} — ${a}`
  }
  const customFolders = useMemo(() => accounts.flatMap((a) => (folders[a.id] ?? []).filter((f) => f.role === 'custom' && !f.noselect && !f.id.startsWith('virtual:')).map((f) => ({ f, email: a.email }))), [accounts, folders])

  return (
    <>
      <Group>
        <Row label="Règles de tri" hint="Appliquées à chaque message qui arrive dans la Réception, dans l’ordre. Déplacement, lecture, suivi, catégorie, Indésirables ou Corbeille.">
          <button className="btn quiet" onClick={() => void run()} disabled={!rules.length}><Play size={14} /> Appliquer maintenant</button>
          <button className="btn primary" onClick={() => setEdit(newRule(null))}><Plus size={14} /> Nouvelle règle</button>
        </Row>
        {rules.length === 0 && !edit && <div className="frow" style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)' }}>Aucune règle. Exemple : « Expéditeur contient @qonto.com → Déplacer vers BANQUE, marquer comme lu ».</div>}
        {rules.map((r, i) => (
          <div key={r.id} className="frow rule-row">
            <div className="rule-order"><button className="icon-btn" onClick={() => void move(i, -1)} disabled={i === 0}><ChevronUp size={13} /></button><GripVertical size={13} style={{ color: 'var(--text-3)' }} /><button className="icon-btn" onClick={() => void move(i, 1)} disabled={i === rules.length - 1}><ChevronDown size={13} /></button></div>
            <div className="rule-main" onClick={() => setEdit(r)} role="button">
              <div className="rule-name">{r.name}{r.accountId && <span className="rule-acc">{accounts.find((a) => a.id === r.accountId)?.email}</span>}{(r.scope ?? 'inbox') !== 'inbox' && <span className="rule-acc">{r.scope === 'both' ? 'Réception + Indésirables' : 'Indésirables'}</span>}</div>
              <div className="rule-desc">{describe(r)}</div>
            </div>
            <Switch on={r.enabled} onChange={async (v) => { await invoke('rules:save', { ...r, enabled: v }); load() }} />
            <button className="icon-btn" title="Appliquer cette règle aux messages existants" onClick={() => void run(r)}><Play size={14} /></button>
            <button className="icon-btn" title="Supprimer" onClick={async () => { if (await useUi.getState().confirm({ title: `Supprimer la règle « ${r.name} » ?`, okLabel: 'Supprimer', danger: true })) { await invoke('rules:delete', r.id); load() } }}><Trash2 size={14} /></button>
          </div>
        ))}
      </Group>

      {edit && (
        <div className="group rule-editor">
          <div className="rule-editor-title">{edit.id ? 'Modifier la règle' : 'Nouvelle règle'}</div>
          <Row label="Nom"><TextInput value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Row>
          <Row label="Compte">
            <Select value={edit.accountId ?? ''} onChange={(e) => setEdit({ ...edit, accountId: e.target.value || null, actions: edit.actions.map((a) => a.type === 'move' ? { ...a, folderId: '' } : a) })}>
              <option value="">Tous les comptes</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.email}</option>)}
            </Select>
          </Row>
          <Row column label="Conditions" hint="Le message est concerné si…">
            <div className="rule-match"><span>Si</span><Select value={edit.match} onChange={(e) => setEdit({ ...edit, match: e.target.value as Rule['match'] })}><option value="all">toutes les conditions</option><option value="any">au moins une condition</option></Select><span>ci-dessous sont vérifiées :</span></div>
            {edit.conditions.map((c, i) => (
              <div key={i} className="rule-line">
                <Select value={c.field} onChange={(e) => { const field = e.target.value as RuleField; const cs = [...edit.conditions]; cs[i] = { field, op: OPS[field][0].v, value: '' }; setEdit({ ...edit, conditions: cs }) }}>{FIELDS.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}</Select>
                <Select value={c.op} onChange={(e) => { const cs = [...edit.conditions]; cs[i] = { ...c, op: e.target.value as RuleOp }; setEdit({ ...edit, conditions: cs }) }}>{OPS[c.field].map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</Select>
                {c.field === 'category'
                  ? <Select value={c.value} onChange={(e) => { const cs = [...edit.conditions]; cs[i] = { ...c, value: e.target.value }; setEdit({ ...edit, conditions: cs }) }}><option value="">—</option>{CATS.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}</Select>
                  : (c.field === 'attachment' && (c.op === 'is' || c.op === 'isNot')) ? <span />
                  : (c.field === 'from' || c.field === 'to')
                    ? <AddressInput value={c.value} placeholder="Nom, adresse ou @domaine…" onChange={(v) => { const cs = [...edit.conditions]; cs[i] = { ...c, value: v }; setEdit({ ...edit, conditions: cs }) }} />
                    : <TextInput value={c.value} placeholder="texte" onChange={(e) => { const cs = [...edit.conditions]; cs[i] = { ...c, value: e.target.value }; setEdit({ ...edit, conditions: cs }) }} />}
                <button className="icon-btn" onClick={() => setEdit({ ...edit, conditions: edit.conditions.filter((_, k) => k !== i) })} disabled={edit.conditions.length === 1}><Trash2 size={13} /></button>
              </div>
            ))}
            <button className="btn quiet rule-add" onClick={() => setEdit({ ...edit, conditions: [...edit.conditions, { field: 'subject', op: 'contains', value: '' }] })}><Plus size={13} /> Ajouter une condition</button>
          </Row>
          <Row column label="Actions">
            {edit.actions.map((a, i) => (
              <div key={i} className="rule-line act">
                <Select value={a.type} onChange={(e) => { const t = e.target.value as RuleAction['type']; const as = [...edit.actions]; as[i] = t === 'move' ? { type: 'move', folderId: '' } : t === 'category' ? { type: 'category', value: 'action' } : { type: t } as RuleAction; setEdit({ ...edit, actions: as }) }}>{ACTIONS.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}</Select>
                {a.type === 'move' && <Select value={a.folderId} onChange={(e) => { const as = [...edit.actions]; as[i] = { type: 'move', folderId: e.target.value }; setEdit({ ...edit, actions: as }) }}><option value="">Choisir un dossier…</option>{foldersFor(edit.accountId).map(({ f, email }) => <option key={f.id} value={f.id}>{leafOf(f)}{!edit.accountId ? ` — ${email}` : ''}</option>)}</Select>}
                {a.type === 'category' && <Select value={a.value} onChange={(e) => { const as = [...edit.actions]; as[i] = { type: 'category', value: e.target.value as any }; setEdit({ ...edit, actions: as }) }}>{CATS.filter((x) => x.v !== 'spam').map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}</Select>}
                {a.type !== 'move' && a.type !== 'category' && <span />}
                <button className="icon-btn" onClick={() => setEdit({ ...edit, actions: edit.actions.filter((_, k) => k !== i) })} disabled={edit.actions.length === 1}><Trash2 size={13} /></button>
              </div>
            ))}
            <button className="btn quiet rule-add" onClick={() => setEdit({ ...edit, actions: [...edit.actions, { type: 'markRead' }] })}><Plus size={13} /> Ajouter une action</button>
          </Row>
          <Row label="S’applique aux messages arrivant dans" hint="« Indésirables » permet de rattraper un mail mal filtré par le serveur, avec l’action « Remettre en Réception ».">
            <Select value={edit.scope ?? 'inbox'} onChange={(e) => setEdit({ ...edit, scope: e.target.value as Rule['scope'] })} style={{ width: 220 }}><option value="inbox">Réception</option><option value="spam">Indésirables</option><option value="both">Réception et Indésirables</option></Select>
          </Row>
          <Row label="Arrêter après cette règle" hint="Les règles suivantes ne sont pas évaluées pour ce message."><Switch on={edit.stop} onChange={(v) => setEdit({ ...edit, stop: v })} /></Row>
          <Row label="">
            <button className="btn quiet" onClick={() => setEdit(null)}>Annuler</button>
            <button className="btn primary" disabled={!edit.name.trim() || !edit.actions.length} onClick={() => void save()}>Enregistrer</button>
          </Row>
        </div>
      )}

      <Group>
        <Row label="Rétention par dossier" hint="Suppression définitive des messages plus anciens que le délai, dossier par dossier (comme Indésirables et Corbeille dans Comptes). Vérifié toutes les 6 heures." column>
          {customFolders.some(({ f }) => f.purgeDays) && (
            <div className="frow col" style={{ gap: 6 }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Dossiers avec rétention</div>
              {customFolders.filter(({ f }) => f.purgeDays).map(({ f, email }) => (
                <div key={f.id} className="frow" style={{ gap: 10, alignItems: 'center', paddingLeft: 0 }}>
                  <span style={{ flex: 1, fontSize: 'var(--fs-sm)' }}>{leafOf(f)} <span style={{ color: 'var(--text-3)', fontSize: 'var(--fs-xs)' }}>{email}</span></span>
                  <Select value={String(f.purgeDays)} onChange={async (e) => { await invoke('folders:setRetention', f.id, e.target.value ? Number(e.target.value) : null); await useAccounts.getState().loadFolders() }} style={{ width: 170 }}>{RETENTION.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</Select>
                </div>
              ))}
            </div>
          )}
          <div className="list-search" style={{ margin: 0 }}><Search size={14} /><input value={retQuery} placeholder="Adresse e-mail du compte, ou nom de dossier…" onChange={(e) => setRetQuery(e.target.value)} list="ret-accounts" />{retQuery && <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => setRetQuery('')}><X size={12} /></button>}</div>
          <datalist id="ret-accounts">{accounts.map((a) => <option key={a.id} value={a.email} />)}</datalist>
          {retQuery.trim() && (() => {
            const q = retQuery.trim().toLowerCase()
            // « adresse dossier » : l'adresse (ou son début) cible le compte, le reste filtre les dossiers
            const [first, ...rest] = q.split(/\s+/)
            const acc = accounts.find((a) => a.email.toLowerCase() === first) ?? accounts.find((a) => a.email.toLowerCase().startsWith(first))
            const folderQ = acc ? rest.join(' ') : q
            const list = customFolders.filter(({ f, email }) => (acc ? f.accountId === acc.id : (email.toLowerCase().includes(q) || leafOf(f).toLowerCase().includes(q))) && (!folderQ || leafOf(f).toLowerCase().includes(folderQ))).slice(0, 30)
            if (!list.length) return <div className="frow" style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)' }}>Aucun dossier ne correspond.</div>
            return list.map(({ f, email }) => (
              <div key={f.id} className="frow" style={{ gap: 10, alignItems: 'center', paddingLeft: 0 }}>
                <span style={{ flex: 1, fontSize: 'var(--fs-sm)' }}>{leafOf(f)} <span style={{ color: 'var(--text-3)', fontSize: 'var(--fs-xs)' }}>{email}</span></span>
                <Select value={f.purgeDays ? String(f.purgeDays) : ''} onChange={async (e) => { await invoke('folders:setRetention', f.id, e.target.value ? Number(e.target.value) : null); await useAccounts.getState().loadFolders() }} style={{ width: 170 }}>{RETENTION.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</Select>
              </div>
            ))
          })()}
          {!retQuery.trim() && <div className="frow" style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)', paddingLeft: 0 }}>Tapez l’adresse d’un compte pour lister ses dossiers (ex. « charles.fournier@sodevnet.com », puis un mot pour filtrer : « …@sodevnet.com ducap »).</div>}
        </Row>
      </Group>
    </>
  )
}