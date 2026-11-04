// src/renderer/src/features/compose/useDraft.ts
import { useEffect, useRef } from 'react'
import type { Draft } from '@shared/models/Draft'
import { useCompose } from '@/stores/compose.store'
import { invoke } from '@/lib/api'

export const draftIsEmpty = (d: Draft): boolean =>
  !d.to.length && !d.cc.length && !d.bcc.length && !d.subject.trim() && !d.html.replace(/<[^>]+>/g, '').trim() && !d.attachmentPaths.length

const signature = (d: Draft): string => JSON.stringify([d.accountId, d.to, d.cc, d.bcc, d.subject, d.html, d.attachmentPaths, d.signatureId])

// Enregistre le brouillon sur le serveur (dossier Brouillons) 3 s après la dernière modification.
export function useAutosave(): void {
  const draft = useCompose((s) => s.draft)
  const timer = useRef<number | null>(null)
  const lastSaved = useRef<string>('')
  const saving = useRef(false)

  useEffect(() => {
    if (!draft) { lastSaved.current = ''; return }
    const sig = signature(draft)
    if (sig === lastSaved.current || draftIsEmpty(draft)) return
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(async () => {
      if (saving.current) return
      saving.current = true
      try {
        const saved = await invoke('drafts:keep', draft)
        lastSaved.current = sig
        const cur = useCompose.getState().draft
        if (cur && cur.id === saved.id) useCompose.setState({ draft: { ...cur, imapFolderId: saved.imapFolderId, imapUid: saved.imapUid } })
      } catch {
        try { await invoke('drafts:save', draft); lastSaved.current = sig } catch {}
      } finally { saving.current = false }
    }, 3000)
    return () => { if (timer.current) window.clearTimeout(timer.current) }
  }, [draft])
}