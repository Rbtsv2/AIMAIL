// src/renderer/src/hooks/useHotkeys.ts
import { useEffect } from 'react'
import { useMail } from '@/stores/mail.store'
import { useUi } from '@/stores/ui.store'
import { useCompose } from '@/stores/compose.store'
import { invoke } from '@/lib/api'
import { useCalendar } from '@/stores/calendar.store'

const inField = (e: KeyboardEvent): boolean => {
  const t = e.target as HTMLElement
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
}

export function useHotkeys(): void {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); useUi.getState().setPalette(true); return }
      if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); useCompose.getState().openNew(); return }
      if (mod && e.key === ',') { e.preventDefault(); useUi.getState().openSettings(); return }
      if (mod && e.key === '\\') { e.preventDefault(); useUi.getState().toggleSidebar(); return }
      if (inField(e)) return
      // un dossier de la barre latérale a le focus : Suppr/Retour arrière s'appliquent au dossier, pas au message
      if ((e.key === 'Delete' || e.key === 'Backspace') && (e.target as HTMLElement | null)?.closest?.('.sidebar')) return
      if (mod && e.key.toLowerCase() !== 'a') return
      const m = useMail.getState()
      const cur = m.current
      if (m.selection.length > 1) {
        const map: Record<string, Parameters<typeof m.bulk>[0]> = { e: 'archive', '#': 'trash', Backspace: 'trash', Delete: 'trash', u: 'unread', s: 'star', '!': 'spam' }
        if (map[e.key]) { e.preventDefault(); void m.bulk(map[e.key]); return }
        if (e.key === 'Escape') { m.clearSelection(); return }
        if (e.key === 'a' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); useMail.setState({ selection: m.threads.map((t) => t.id) }); return }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') { e.preventDefault(); useMail.setState({ selection: m.threads.map((t) => t.id) }); return }
      switch (e.key) {
        case 'j': case 'ArrowDown': e.preventDefault(); m.selectRelative(1); break
        case 'k': case 'ArrowUp': e.preventDefault(); m.selectRelative(-1); break
        case 'e': if (cur) void m.archive(cur.thread.id); break
        case '#': case 'Backspace': case 'Delete': if (cur) void m.trash(cur.thread.id); break
        case 'r': if (cur) useCompose.getState().openReply(cur.messages[cur.messages.length - 1], 'reply', cur.thread.id); break
        case 'a': if (cur) useCompose.getState().openReply(cur.messages[cur.messages.length - 1], 'replyAll', cur.thread.id); break
        case 'f': if (cur) useCompose.getState().openReply(cur.messages[cur.messages.length - 1], 'forward', cur.thread.id); break
        case 's': if (cur) void m.flag(cur.messages.map((x) => x.id), { starred: !cur.thread.starred }); break
        case 'u': if (cur) void m.flag(cur.messages.map((x) => x.id), { unread: !cur.thread.unread }); break
        case 'c': useCompose.getState().openNew(); break
        case '!': if (cur) { m.selectRelative(1); void invoke('messages:move', cur.messages.map((x) => x.id), 'spam') } break
        case '/': e.preventDefault(); (document.querySelector('.list-search input') as HTMLInputElement)?.focus(); break
        case 'Escape': { const ui = useUi.getState(); if (ui.settingsOpen) ui.closeSettings(); else if (ui.addAccountOpen) ui.setAddAccount(false); else if (ui.contactsOpen) ui.setContacts(false); else if (ui.calendarOpen && !useCalendar.getState().editing) ui.setCalendar(false); else void m.select(null); break }
      }
      if (e.key === 'R' && e.shiftKey) void invoke('sync:now')
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])
}