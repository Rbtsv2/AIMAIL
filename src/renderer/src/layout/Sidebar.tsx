// src/renderer/src/layout/Sidebar.tsx
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Inbox, Star, Send, FileText, Archive, Trash2, AlertOctagon, Folder as FolderIcon, FolderPlus, Plus, Settings, Sparkles, Pencil, CornerLeftUp, ChevronRight, Users, CalendarDays, MessageSquare, MessageSquarePlus, Pin, PinOff, X } from 'lucide-react'
import type { Folder } from '@shared/models/Folder'
import { useAccounts } from '@/stores/accounts.store'
import { useMail } from '@/stores/mail.store'
import { useUi } from '@/stores/ui.store'
import { useChat } from '@/stores/chat.store'
import { invoke } from '@/lib/api'
import { beginDrag, onDrop, setResolver, useDnd, clickSuppressed } from '@/lib/dnd'
import { TitleBar } from './TitleBar'
import { Resizer } from './Resizer'
import { IconButton } from '@/design-system/IconButton'

const ROLE_ICON: Record<string, typeof Inbox> = { inbox: Inbox, starred: Star, sent: Send, drafts: FileText, archive: Archive, trash: Trash2, spam: AlertOctagon, custom: FolderIcon }
const ROLE_LABEL: Record<string, string> = { inbox: 'Réception', starred: 'Suivis', sent: 'Envoyés', drafts: 'Brouillons', archive: 'Archive', trash: 'Corbeille', spam: 'Indésirables' }
const ORDER = ['inbox', 'starred', 'drafts', 'sent', 'archive', 'custom', 'spam', 'trash']

const parentPathOf = (f: Folder): string => (f.path.includes(f.delimiter) ? f.path.slice(0, f.path.lastIndexOf(f.delimiter)) : '')
const rootOf = (fs: Folder[]): string => { const f = fs.find((x) => x.role === 'custom'); if (!f) return ''; const parts = f.path.split(f.delimiter); return parts[0] === 'INBOX' && parts.length > 1 ? 'INBOX' : '' }

// tri : dossiers système dans l'ordre fixe, puis dossiers personnalisés en arbre (ordre manuel, sinon alphabétique)
function orderFolders(input: Folder[]): Folder[] {
  // parents absents de la liste du serveur (ex. OVH : « MAITRE DUCAP  » avec espace finale) : reconstitués comme groupes
  const all = [...input]
  const paths = new Set(all.map((f) => f.path))
  for (const f of input) {
    if (f.role !== 'custom') continue
    const parts = f.path.split(f.delimiter)
    for (let i = parts.length - 1; i >= 2 || (i >= 1 && parts[0] !== 'INBOX'); i--) {
      const p = parts.slice(0, i).join(f.delimiter)
      if (p === 'INBOX' || paths.has(p)) continue
      paths.add(p)
      all.push({ id: `virtual:${f.accountId}:${p}`, accountId: f.accountId, path: p, name: parts[i - 1].trim(), role: 'custom', delimiter: f.delimiter, unread: 0, total: 0, uidValidity: 0, uidNext: 0, sortOrder: null, noselect: true })
    }
  }
  const system = all.filter((f) => f.role !== 'custom').sort((a, b) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role))
  const custom = all.filter((f) => f.role === 'custom')
  const byParent = new Map<string, Folder[]>()
  for (const f of custom) { const p = parentPathOf(f); const arr = byParent.get(p) ?? []; arr.push(f); byParent.set(p, arr) }
  const cmp = (a: Folder, b: Folder) => (a.sortOrder ?? 1e9) - (b.sortOrder ?? 1e9) || leafOf(a).localeCompare(leafOf(b), 'fr')
  const out: Folder[] = []
  const walk = (parent: string) => { for (const f of (byParent.get(parent) ?? []).sort(cmp)) { if (out.includes(f)) continue; out.push(f); walk(f.path) } }
  // sous-dossiers d'un dossier système (ex. Outlook : Archive/2026) : rattachés juste sous ce dossier
  const withChildren = (f: Folder): Folder[] => { const before = out.length; walk(f.path); return out.splice(before) }
  const spam = system.filter((f) => f.role === 'spam' || f.role === 'trash')
  const head = system.filter((f) => f.role !== 'spam' && f.role !== 'trash')
  const result: Folder[] = []
  for (const f of head) { result.push(f); const kids = withChildren(f); result.push(...kids); out.push(...kids) }
  const root = rootOf(all)
  const start = out.length
  walk(root)
  for (const f of custom) if (!out.includes(f)) out.push(f) // orphelins (parent non sélectionnable)
  result.push(...out.slice(start))
  for (const f of spam) { result.push(f); const kids = withChildren(f); result.push(...kids); out.push(...kids) }
  return result
}

type Menu = { x: number; y: number; folder: Folder | null; accountId: string }

function depthOf(f: Folder): number {
  const parts = f.path.split(f.delimiter)
  const base = parts[0] === 'INBOX' && parts.length > 1 ? 2 : 1
  return Math.max(0, parts.length - base)
}
const leafOf = (f: Folder) => (f.path.split(f.delimiter).pop() ?? f.name).trim()

function Item({ f, label, count, active, onClick, onContext, onRename, depth = 0, editing, onEditDone, container }: {
  f?: Folder; label: string; count?: number; active: boolean; onClick: () => void; onContext?: (e: React.MouseEvent) => void; onRename?: () => void; depth?: number
  editing?: boolean; onEditDone?: (name: string | null) => void; container?: boolean
}) {
  const Icon = f ? (ROLE_ICON[f.role] ?? FolderIcon) : FolderIcon
  const over = useDnd((s) => !!f && s.hover === f.id)
  const dragging = useDnd((s) => !!f && s.payload?.kind === 'folder' && s.payload.id === f.id)
  const inputRef = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  useEffect(() => { if (editing) { done.current = false; setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 10) } }, [editing])
  const finish = (v: string | null) => { if (done.current) return; done.current = true; onEditDone?.(v) }
  return (
    <motion.button layout="position" transition={{ type: 'spring', stiffness: 520, damping: 38, mass: 0.7 }} className={`sidebar-item no-drag ${active ? 'active' : ''} ${over ? 'drop' : ''} ${dragging ? 'lifting' : ''} ${container ? 'container' : ''}`} style={{ paddingLeft: 8 + depth * 14 }}
      data-drop-folder={f?.id}
      onClick={() => { if (!clickSuppressed() && !container) onClick() }} onContextMenu={onContext}
      onDoubleClick={(e) => { if (f?.role === 'custom' && !editing) { e.preventDefault(); onRename?.() } }}
      onPointerDown={(e) => { if (f && f.role === 'custom' && !editing && !(e.target as HTMLElement).closest('input')) beginDrag(e, { kind: 'folder', id: f.id, label }) }}>
      <Icon size={15} />
      {editing
        ? <input ref={inputRef} className="rename" defaultValue={label} onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Enter') finish((e.target as HTMLInputElement).value); if (e.key === 'Escape') finish(null) }}
            onBlur={(e) => finish(e.target.value)} />
        : <span className="label">{label}</span>}
      {!!count && !editing && <span className="count">{count}</span>}
    </motion.button>
  )
}

function AccountHeader({ accountId, color, email, unread, collapsed, onToggle, onCreate }: { accountId: string; color: string; email: string; unread: number; collapsed: boolean; onToggle: () => void; onCreate: () => void }) {
  const lifting = useDnd((s) => s.payload?.kind === 'account' && s.payload.id === accountId)
  return (
    <div className={`sidebar-account toggle ${collapsed ? 'collapsed' : ''} ${lifting ? 'lifting' : ''}`} data-account={accountId} onClick={() => { if (!clickSuppressed()) onToggle() }} role="button" aria-expanded={!collapsed}
      onPointerDown={(e) => { if (!(e.target as HTMLElement).closest('button')) beginDrag(e, { kind: 'account', id: accountId, label: email }) }}>
      <ChevronRight size={12} className="chev" />
      <span className="dot" style={{ background: color }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={email}>{email}</span>
      {collapsed && unread > 0 && <span className="count">{unread}</span>}
      {!collapsed && <button className="icon-btn" style={{ width: 22, height: 22 }} title="Nouveau dossier" onClick={(e) => { e.stopPropagation(); onCreate() }}><FolderPlus size={13} /></button>}
    </div>
  )
}

const INDENT = 14

// réordonnancement des comptes : ligne d'insertion entre les en-têtes
function resolveAccountDrop(y: number, draggedId: string): { hover: string | null; line: { top: number; left: number; width: number } | null } | null {
  const heads = [...document.querySelectorAll<HTMLElement>('.sidebar [data-account]')].map((el) => ({ id: el.dataset.account!, r: el.getBoundingClientRect(), section: el.closest<HTMLElement>('.sidebar-section')?.getBoundingClientRect() ?? el.getBoundingClientRect() }))
  if (!heads.length) return { hover: null, line: null }
  const ids = heads.map((h) => h.id).filter((id) => id !== draggedId)
  let index = ids.length
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i]
    const mid = (h.section.top + h.section.bottom) / 2
    if (y < mid) { index = ids.indexOf(h.id) >= 0 ? ids.indexOf(h.id) : index; break }
  }
  const ordered = [...ids.slice(0, index), draggedId, ...ids.slice(index)]
  const ref = index < ids.length ? heads.find((h) => h.id === ids[index])! : heads[heads.length - 1]
  const top = index < ids.length ? ref.section.top - 1 : ref.section.bottom + 1
  return { hover: `accounts:${ordered.join(',')}`, line: { top, left: ref.r.left + 4, width: ref.r.width - 8 } }
}

function resolveFolderDrop(x: number, y: number, draggedId: string): { hover: string | null; line: { top: number; left: number; width: number } | null } | null {
  const all = Object.values(useAccounts.getState().folders).flat()
  const byId = new Map(all.map((f) => [f.id, f]))
  const dragged = byId.get(draggedId)
  const inSubtree = (f: Folder) => !!dragged && (f.id === dragged.id || f.path.startsWith(dragged.path + dragged.delimiter))
  const rows = [...document.querySelectorAll<HTMLElement>('.sidebar [data-drop-folder]')].map((el) => ({ el, f: byId.get(el.dataset.dropFolder ?? ''), r: el.getBoundingClientRect() })).filter((r) => r.f && !inSubtree(r.f) && !r.f.id.startsWith('virtual:'))
  const row = rows.find((r) => y >= r.r.top && y <= r.r.bottom)
  const side = document.querySelector('.sidebar-scroll')?.getBoundingClientRect()
  if (!row) {
    // sous le dernier dossier d'un compte : racine de ce compte
    const last = [...rows].reverse().find((r) => r.r.bottom <= y)
    if (!last || !side || x < side.left || x > side.right) return { hover: null, line: null }
    return { hover: `parent:${last.f!.accountId}::${last.f!.id}:after`, line: { top: last.r.bottom - 1, left: last.r.left + 8, width: last.r.width - 16 } }
  }
  const f = row.f!
  const zone = (y - row.r.top) / row.r.height
  if (zone > 0.3 && zone < 0.7 && f.role === 'custom' && !f.noselect) return { hover: f.id, line: null }
  // insertion entre deux lignes : le parent dépend de la position horizontale
  const above = zone <= 0.3 ? rows[rows.indexOf(row) - 1] : row
  const ref = above && above.f!.accountId === f.accountId ? above.f! : null
  const maxDepth = ref && ref.role === 'custom' ? depthOf(ref) + 1 : 0
  const depth = Math.max(0, Math.min(maxDepth, Math.round((x - row.r.left - 8) / INDENT)))
  let parentId = ''
  if (ref && depth > 0) {
    const parts = ref.path.split(ref.delimiter)
    const base = parts.length - depthOf(ref)
    const parentPath = parts.slice(0, base + depth - 1).join(ref.delimiter)
    parentId = all.find((p) => p.accountId === ref.accountId && p.path === parentPath && !p.id.startsWith('virtual:'))?.id ?? ''
  }
  const top = zone <= 0.3 ? row.r.top - 1 : row.r.bottom - 1
  return { hover: `parent:${f.accountId}:${parentId}:${f.id}:${zone <= 0.3 ? 'before' : 'after'}`, line: { top, left: row.r.left + 8 + depth * INDENT, width: row.r.width - 16 - depth * INDENT } }
}

export function Sidebar() {
  const accounts = useAccounts((s) => s.accounts)
  const folders = useAccounts((s) => s.folders)
  const loadFolders = useAccounts((s) => s.loadFolders)
  const view = useMail((s) => s.view)
  const setView = useMail((s) => s.setView)
  const openSettings = useUi((s) => s.openSettings)
  const setAddAccount = useUi((s) => s.setAddAccount)
  const toast = useUi((s) => s.toast)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState<{ accountId: string; parentId: string | null } | null>(null)
  const chats = useChat((s) => s.list)
  const chatId = useChat((s) => s.chatId)
  useEffect(() => { void useChat.getState().loadList() }, [])
  const openChat = async (id: string) => { await useChat.getState().open(id); void useMail.getState().select(null); useUi.getState().closeSettings(); useUi.getState().setContacts(false); useUi.getState().setCalendar(false) }
  const [collapsed, setCollapsed] = useState<Set<string>>(() => { try { return new Set(JSON.parse(localStorage.getItem('sidebar.collapsed') ?? '[]')) } catch { return new Set() } })
  const toggleAccount = (id: string) => setCollapsed((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); localStorage.setItem('sidebar.collapsed', JSON.stringify([...n])); return n })
  useEffect(() => {
    onDrop((payload, targetId) => {
      if (targetId.startsWith('accounts:')) {
        const ordered = targetId.slice('accounts:'.length).split(',')
        void run(async () => { await invoke('accounts:reorder', ordered); await useAccounts.getState().load() }, 'Comptes réordonnés')
        return
      }
      if (targetId.startsWith('parent:')) {
        const [, accountId, parentIdRaw, refId, side] = targetId.split(':')
        const parentId = parentIdRaw || null
        if (payload.kind !== 'folder') return
        void run(async () => {
          const all = useAccounts.getState().folders[accountId] ?? []
          const dragged = all.find((f) => f.id === payload.id)
          if (!dragged) return
          const parent = parentId ? all.find((f) => f.id === parentId) : undefined
          const curParent = parentPathOf(dragged)
          const newParentPath = parent ? parent.path : rootOf(all)
          if (newParentPath !== curParent) await invoke('folders:move', payload.id, parentId)
          // ordre des frères sous le nouveau parent
          const fresh = await invoke('folders:list', accountId)
          const me = fresh.find((f) => f.id === payload.id)!
          const siblings = orderFolders(fresh.filter((f) => f.role === 'custom' && parentPathOf(f) === parentPathOf(me) && f.id !== me.id))
          const ref = siblings.find((f) => f.id === refId)
          let at = siblings.length
          if (ref) at = siblings.indexOf(ref) + (side === 'after' ? 1 : 0)
          else if (refId) {
            // référence hors du niveau : insérer après l'ancêtre de ce niveau, ou au début
            const refFolder = fresh.find((f) => f.id === refId)
            const anc = refFolder ? siblings.find((s) => refFolder.path === s.path || refFolder.path.startsWith(s.path + s.delimiter)) : undefined
            at = anc ? siblings.indexOf(anc) + 1 : 0
          }
          const ordered = [...siblings.slice(0, at), me, ...siblings.slice(at)]
          await invoke('folders:reorder', ordered.map((f) => f.id))
          await loadFolders(accountId)
        }, 'Dossier déplacé')
        return
      }
      const all = Object.values(useAccounts.getState().folders).flat()
      const target = all.find((x) => x.id === targetId)
      if (!target) return
      const name = target.role === 'custom' ? leafOf(target) : ROLE_LABEL[target.role]
      if (payload.kind === 'folder') void run(() => invoke('folders:move', payload.id, target.id), `Déplacé dans ${name}`)
      else if (payload.kind === 'threads') void useMail.getState().bulk('folder', target.id)
      else void run(async () => {
        const r = await invoke('threads:get', payload.id)
        await invoke('messages:moveToFolder', r.messages.map((m) => m.id), target.id)
        if (useMail.getState().selectedId === payload.id) useMail.getState().selectRelative(1)
      }, `Déplacé vers ${name}`)
    })
    setResolver((x, y, payload) => (payload.kind === 'folder' ? resolveFolderDrop(x, y, payload.id) : payload.kind === 'account' ? resolveAccountDrop(y, payload.id) : null))
    return () => { onDrop(null); setResolver(null) }
  }, [])

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('click', close); window.addEventListener('keydown', close)
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', close) }
  }, [menu])

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try { await fn(); if (ok) toast({ text: ok }) } catch (e: any) { toast({ text: String(e?.message ?? e).replace(/^Error invoking remote method '[^']+': Error: /, ''), ttl: 6000 }) }
  }

  const unifiedCount = (role: string) => Object.values(folders).flat().filter((f) => f.role === role).reduce((n, f) => n + f.unread, 0)
  const isUnified = (role: string) => !view.accountId && view.role === role

  return (
    <aside className="sidebar" style={{ position: 'relative' }}>
      <div className="sidebar-top"><TitleBar /></div>
      <div className="sidebar-scroll">
        {accounts.length > 1 && (
          <div className="sidebar-section">
            <div className="sidebar-account">Toutes les boîtes</div>
            {(['inbox', 'starred', 'sent', 'drafts', 'archive'] as const).map((r) => (
              <Item key={r} label={ROLE_LABEL[r]} count={r === 'inbox' ? unifiedCount(r) : undefined} active={isUnified(r)} onClick={() => setView({ role: r, label: ROLE_LABEL[r] })} />
            ))}
          </div>
        )}
        {accounts.map((a) => {
          const fs = orderFolders((folders[a.id] ?? []).filter((f) => f.role !== 'all'))
          return (
            <div className="sidebar-section" key={a.id} onContextMenu={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, folder: null, accountId: a.id }) } }}>
              <AccountHeader accountId={a.id} color={a.color} email={a.email} unread={fs.find((f) => f.role === 'inbox')?.unread ?? 0} collapsed={collapsed.has(a.id)} onToggle={() => toggleAccount(a.id)} onCreate={() => { setCollapsed((p) => { const n = new Set(p); n.delete(a.id); return n }); setCreating({ accountId: a.id, parentId: null }) }} />
              <div className={`sidebar-folders ${collapsed.has(a.id) && creating?.accountId !== a.id ? 'hidden' : ''}`}>
              {(() => {
                const parent = creating?.accountId === a.id && creating.parentId ? fs.find((x) => x.id === creating.parentId) : undefined
                let insertAfter = -1
                if (creating?.accountId === a.id) {
                  if (parent) fs.forEach((x, i) => { if (x.id === parent.id || x.path.startsWith(parent.path + parent.delimiter)) insertAfter = i })
                  else insertAfter = fs.length - 1
                }
                const input = creating?.accountId === a.id ? (
                  <div key="__new" className="sidebar-item creating" style={{ paddingLeft: 8 + (parent ? depthOf(parent) + 1 : 0) * 14 }}>
                    <FolderIcon size={15} />
                    <input className="rename" autoFocus placeholder={parent ? `Sous-dossier de ${leafOf(parent)}` : 'Nom du dossier'}
                      onKeyDown={(e) => {
                        const v = (e.target as HTMLInputElement).value.trim()
                        if (e.key === 'Enter' && v) { const parentId = creating.parentId; setCreating(null); void run(() => invoke('folders:create', a.id, v, parentId).then(() => loadFolders(a.id)), 'Dossier créé') }
                        if (e.key === 'Escape') setCreating(null)
                      }}
                      onBlur={() => setCreating(null)} />
                  </div>
                ) : null
                const items = fs.map((f) => (
                  <Item key={f.id} f={f} depth={f.role === 'custom' ? depthOf(f) : 0} label={f.role === 'custom' ? leafOf(f) : ROLE_LABEL[f.role]} container={f.noselect}
                    count={!f.noselect && (f.role === 'inbox' || f.role === 'custom') ? f.unread : undefined}
                    active={view.folderId === f.id}
                    onClick={() => setView({ accountId: a.id, folderId: f.id, label: f.role === 'custom' ? leafOf(f) : ROLE_LABEL[f.role] })}
                    onContext={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, folder: f, accountId: a.id }) }}
                    editing={editing === f.id}
                    onEditDone={(name) => { setEditing(null); const v = name?.trim(); if (v && v !== leafOf(f)) void run(() => invoke('folders:rename', f.id, v), 'Dossier renommé') }}
                    onRename={() => setEditing(f.id)} />
                ))
                if (input) items.splice(insertAfter + 1, 0, input)
                return <div><AnimatePresence initial={false}>{items}</AnimatePresence></div>
              })()}
              </div>
            </div>
          )
        })}
      </div>
      {chats.length > 0 && (
        <div className="sidebar-section chats">
          <div className="sidebar-account"><MessageSquare size={13} style={{ color: 'var(--text-2)' }} /><span style={{ flex: 1 }}>Conversations</span><button className="icon-btn" title="Nouvelle conversation" onClick={() => { useChat.getState().clear(); useChat.getState().closePanel(); void useMail.getState().select(null); useUi.getState().closeSettings(); useUi.getState().setContacts(false); useUi.getState().setCalendar(false) }}><Plus size={13} /></button></div>
          {chats.slice(0, 12).map((c) => (
            <div key={c.id} className={`sidebar-item chat-item no-drag ${chatId === c.id ? 'active' : ''}`} onClick={() => void openChat(c.id)} role="button">
              {c.pinned ? <Pin size={13} style={{ color: 'var(--accent)' }} /> : <MessageSquare size={13} />}
              <span className="label" title={c.title}>{c.title}</span>
              <span className="chat-actions" onClick={(e) => e.stopPropagation()}>
                <button className="icon-btn" title={c.pinned ? 'Détacher' : 'Épingler'} onClick={() => void useChat.getState().pin(c.id, !c.pinned)}>{c.pinned ? <PinOff size={12} /> : <Pin size={12} />}</button>
                <button className="icon-btn" title="Supprimer" onClick={() => { if (confirm('Supprimer cette conversation ?')) void useChat.getState().remove(c.id) }}><X size={12} /></button>
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="sidebar-footer">
        <IconButton label="Ajouter un compte" onClick={() => setAddAccount(true)}><Plus size={16} /></IconButton>
        <IconButton label="Agenda" onClick={() => useUi.getState().setCalendar(true)}><CalendarDays size={16} /></IconButton>
        <IconButton label="Contacts" onClick={() => useUi.getState().setContacts(true)}><Users size={16} /></IconButton>
        <IconButton label="Nouvelle conversation avec l’assistant" onClick={() => { useChat.getState().clear(); useChat.getState().closePanel(); void useMail.getState().select(null); useUi.getState().closeSettings(); useUi.getState().setContacts(false); useUi.getState().setCalendar(false); setAddAccount(false) }}><MessageSquarePlus size={16} /></IconButton>
        <IconButton label="Réglages de l’IA" onClick={() => openSettings('ai')}><Sparkles size={16} /></IconButton>
        <div style={{ flex: 1 }} />
        <IconButton label="Réglages" onClick={() => openSettings()}><Settings size={16} /></IconButton>
      </div>
      <Resizer cssVar="--sidebar-w" min={180} max={320} />
      {menu && (
        <div className="ctx" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => { setMenu(null); setCreating({ accountId: menu.accountId, parentId: menu.folder?.role === 'custom' ? menu.folder.id : null }) }}><FolderPlus size={14} /> {menu.folder?.role === 'custom' ? 'Nouveau sous-dossier' : 'Nouveau dossier'}</button>
          {menu.folder?.role === 'custom' && <>
            <button onClick={() => { setMenu(null); setEditing(menu.folder!.id) }}><Pencil size={14} /> Renommer</button>
            {depthOf(menu.folder) > 0 && <button onClick={() => { setMenu(null); void run(() => invoke('folders:move', menu.folder!.id, null), 'Dossier déplacé à la racine') }}><CornerLeftUp size={14} /> Déplacer à la racine</button>}
            <div className="sep" />
            <button className="danger" onClick={() => { setMenu(null); if (confirm(`Supprimer le dossier « ${leafOf(menu.folder!)} » et son contenu sur le serveur ?`)) void run(() => invoke('folders:delete', menu.folder!.id), 'Dossier supprimé') }}><Trash2 size={14} /> Supprimer</button>
          </>}
        </div>
      )}
    </aside>
  )
}