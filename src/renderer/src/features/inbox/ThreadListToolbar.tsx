// src/renderer/src/features/inbox/ThreadListToolbar.tsx
import { PenLine, PanelLeft, Trash2 } from 'lucide-react'
import { invoke } from '@/lib/api'
import { useUi } from '@/stores/ui.store'
import { SearchBar } from '@/features/search/SearchBar'
import { useMail } from '@/stores/mail.store'
import { useCompose } from '@/stores/compose.store'
import { useAccounts } from '@/stores/accounts.store'
import { IconButton } from '@/design-system/IconButton'

export function ThreadListToolbar() {
  const view = useMail((s) => s.view)
  const search = useMail((s) => s.search)
  const count = useMail((s) => s.threads.length)
  const collapsed = useUi((s) => s.sidebarCollapsed)
  const toggleSidebar = useUi((s) => s.toggleSidebar)
  const status = useAccounts((s) => s.status)
  const folders = useAccounts((s) => s.folders)
  const threads = useMail((s) => s.threads)
  const emptyable = (() => {
    if (view.folderId) { const f = Object.values(folders).flat().find((x) => x.id === view.folderId); return f && (f.role === 'trash' || f.role === 'spam') ? [f] : [] }
    if (view.role === 'trash' || view.role === 'spam') return Object.values(folders).flat().filter((f) => f.role === view.role)
    return []
  })()
  const emptyAll = async () => {
    if (!emptyable.length || !confirm(`Supprimer définitivement tous les messages de « ${view.label} » ?`)) return
    let n = 0
    for (const f of emptyable) n += await invoke('folders:empty', f.id)
    useUi.getState().toast({ text: `${n} message${n > 1 ? 's' : ''} supprimé${n > 1 ? 's' : ''} définitivement` })
  }
  const anySyncing = Object.values(status).some((x) => x.state === 'syncing')
  const anyError = Object.values(status).find((x) => x.state === 'error' || x.state === 'offline')
  return (
    <>
      <div className="list-head drag">
        {collapsed && <IconButton label="Afficher la barre latérale (⌘\\)" onClick={toggleSidebar}><PanelLeft size={16} /></IconButton>}
        <span className="list-title">{search ? `Résultats${count ? ` · ${count}` : ''}` : view.label}</span>
        {(anySyncing || anyError) && <span className={`status-pill ${anySyncing ? 'syncing' : anyError?.state}`} title={anySyncing ? 'Synchronisation en cours' : anyError?.state === 'offline' ? 'Hors ligne' : `Erreur : ${anyError?.error ?? ''}`}><span className="d" /></span>}
        {emptyable.length > 0 && threads.length > 0 && !search && <button className="btn quiet no-drag" style={{ color: 'var(--danger)' }} onClick={() => void emptyAll()}><Trash2 size={14} /> Vider</button>}
        <IconButton label="Nouveau message (⌘N)" onClick={() => useCompose.getState().openNew(view.accountId)}><PenLine size={16} /></IconButton>
      </div>
      <SearchBar />
    </>
  )
}