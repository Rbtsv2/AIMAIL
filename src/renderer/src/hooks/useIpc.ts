// src/renderer/src/hooks/useIpc.ts
import { useEffect } from 'react'
import { on, api } from '@/lib/api'
import { useAccounts } from '@/stores/accounts.store'
import { useMail } from '@/stores/mail.store'
import { useAi } from '@/stores/ai.store'
import { useCompose } from '@/stores/compose.store'
import { useUi } from '@/stores/ui.store'
import { useChat } from '@/stores/chat.store'

export function useIpcBridge(): void {
  useEffect(() => {
    let timer: number | null = null
    const pending = { accounts: new Set<string>(), threads: new Set<string>(), all: false }

    const flush = () => {
      timer = null
      const m = useMail.getState()
      void m.refresh()
      if (m.selectedId && (pending.all || pending.threads.has(m.selectedId))) void m.reloadCurrent()
      const accs = pending.accounts.size ? [...pending.accounts] : [undefined]
      for (const a of accs) void useAccounts.getState().loadFolders(a)
      pending.accounts.clear(); pending.threads.clear(); pending.all = false
    }
    const schedule = () => { if (timer === null) timer = window.setTimeout(flush, 300) }

    const offs = [
      on('sync:status', (s) => { useAccounts.getState().setStatus(s); if (s.state === 'idle') { pending.accounts.add(s.accountId); schedule() } }),
      on('mail:changed', (p) => {
        if (p.accountId) pending.accounts.add(p.accountId)
        if (p.threadIds) p.threadIds.forEach((t) => pending.threads.add(t)); else pending.all = true
        schedule()
      }),
      on('outbox:changed', (i) => { useCompose.getState().onOutbox(i); if (i.status === 'failed' && i.error !== 'annulé') useUi.getState().toast({ text: `Envoi impossible : ${i.error}`, ttl: 8000 }) }),
      on('ai:token', (p) => { useAi.getState().onToken(p.streamId, p.token); const c = useChat.getState(); if (c.activeTurnId && p.streamId === useAi.getState().streamIdOf()) c.update(c.activeTurnId, { content: useAi.getState().output }) }),
      on('ai:tool', (p) => { useAi.getState().onTool(p.streamId, p.label); const c = useChat.getState(); if (c.activeTurnId && p.streamId === useAi.getState().streamIdOf()) c.addStep(c.activeTurnId, p.label) }),
      on('ai:refs', (p) => { const c = useChat.getState(); if (c.activeTurnId && p.streamId === useAi.getState().streamIdOf()) c.appendRefs(c.activeTurnId, p.refs) }),
      on('ai:done', (p) => { const matches = p.streamId === useAi.getState().streamIdOf(); useAi.getState().onDone(p.streamId, p.text); const c = useChat.getState(); if (c.activeTurnId && matches) { c.update(c.activeTurnId, { content: p.text, streaming: false, tool: null }); c.setActive(null) } }),
      on('ai:error', (p) => { const matches = p.streamId === useAi.getState().streamIdOf(); useAi.getState().onError(p.streamId, p.error); const c = useChat.getState(); if (c.activeTurnId && matches) { c.update(c.activeTurnId, { error: p.error, streaming: false }); c.setActive(null) } }),
      api.onMenu((a) => {
        if (a === 'compose') useCompose.getState().openNew()
        if (a === 'settings') useUi.getState().openSettings()
        if (a === 'palette') useUi.getState().setPalette(true)
        if (a === 'sync') void api.invoke('sync:now')
      }),
      api.onOpenThread((id) => void useMail.getState().select(id))
    ]
    return () => { offs.forEach((f) => f()); if (timer !== null) window.clearTimeout(timer) }
  }, [])
}