// src/renderer/src/hooks/useHotkeys.ts
import { useEffect } from 'react'
import { useMail } from '@/stores/mail.store'
import { useUi } from '@/stores/ui.store'
import { useCompose } from '@/stores/compose.store'
import { invoke } from '@/lib/api'

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
      if (inField(e) || mod) return
      const m = useMail.getState()
      const cur = m.current
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
        case '/': e.preventDefault(); (document.querySelector('.list-search input') as HTMLInputElement)?.focus(); break
        case 'Escape': void m.select(null); break
      }
      if (e.key === 'R' && e.shiftKey) void invoke('sync:now')
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])
}