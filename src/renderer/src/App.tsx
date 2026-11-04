// src/renderer/src/App.tsx
import { useEffect } from 'react'
import { Router } from './router'
import { useIpcBridge } from '@/hooks/useIpc'
import { useHotkeys } from '@/hooks/useHotkeys'
import { useTheme } from '@/hooks/useTheme'
import { useAccounts } from '@/stores/accounts.store'
import { useSettings } from '@/stores/settings.store'
import { useAi } from '@/stores/ai.store'
import { useMail } from '@/stores/mail.store'
import { CommandPalette } from '@/design-system/CommandPalette'
import { Toasts } from '@/design-system/Toast'
import { Composer } from '@/features/compose/Composer'
import { useCompose, composeDraftId } from '@/stores/compose.store'
import { invoke } from '@/lib/api'
import { DragGhost, DropIndicator } from '@/lib/dnd'
import { EventEditor } from '@/features/calendar/EventEditor'
import { ConfirmSend } from '@/design-system/ConfirmSend'
import { useCalendar } from '@/stores/calendar.store'
import { DragStrip } from '@/layout/DragStrip'
import { WindowControls } from '@/layout/WindowControls'

function ComposeApp({ draftId }: { draftId: string }) {
  useIpcBridge(); useTheme()
  useEffect(() => {
    void Promise.all([useAccounts.getState().load(), useSettings.getState().load(), useAi.getState().load()]).then(async () => {
      const d = (await invoke('drafts:list')).find((x) => x.id === draftId)
      if (d) useCompose.getState().openDraft(d); else window.api.closeSelf()
    })
  }, [draftId])
  return <><Composer /><WindowControls /><ConfirmSend /><Toasts /></>
}

export default function App() {
  useIpcBridge(); useHotkeys(); useTheme()
  useEffect(() => { document.documentElement.dataset.platform = window.api.platform }, [])
  const composeId = composeDraftId()
  useEffect(() => {
    if (composeId) return
    void Promise.all([useAccounts.getState().load(), useSettings.getState().load(), useAi.getState().load()]).then(() => useMail.getState().refresh())
    void useCalendar.getState().load()
  }, [])
  if (composeId) return <ComposeApp draftId={composeId} />
  return (
    <>
      <DragStrip />
      <WindowControls />
      <Router />
      <Composer />
      <EventEditor />
      <ConfirmSend />
      <CommandPalette />
      <Toasts />
      <DropIndicator />
      <DragGhost />
    </>
  )
}