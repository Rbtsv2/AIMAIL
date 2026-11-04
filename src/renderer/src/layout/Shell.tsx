// src/renderer/src/layout/Shell.tsx
import { useUi } from '@/stores/ui.store'
import { Sidebar } from './Sidebar'
import { ThreadList } from '@/features/inbox/ThreadList'
import { ThreadView } from '@/features/thread/ThreadView'
import { SettingsPage } from '@/features/settings/SettingsSheet'
import { AddAccountPage } from '@/features/accounts/AddAccountFlow'
import { ContactsPage } from '@/features/contacts/ContactsPage'
import { CalendarPage } from '@/features/calendar/CalendarPage'

export function Shell() {
  const collapsed = useUi((s) => s.sidebarCollapsed)
  const settingsOpen = useUi((s) => s.settingsOpen)
  const addOpen = useUi((s) => s.addAccountOpen)
  const contactsOpen = useUi((s) => s.contactsOpen)
  const calendarOpen = useUi((s) => s.calendarOpen)
  return (
    <div className={`shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar />
      {settingsOpen ? <SettingsPage /> : addOpen ? <AddAccountPage /> : contactsOpen ? <ContactsPage /> : calendarOpen ? <CalendarPage /> : <><ThreadList /><ThreadView /></>}
    </div>
  )
}