import { PanelLeft } from 'lucide-react'
import { isMac } from '@/lib/api'
import { useUi } from '@/stores/ui.store'
import { IconButton } from '@/design-system/IconButton'

export function TitleBar({ children }: { children?: React.ReactNode }) {
  const toggle = useUi((s) => s.toggleSidebar)
  return (
    <div className={`titlebar drag ${isMac ? 'mac' : ''}`}>
      <IconButton label="Afficher ou masquer la barre latérale" onClick={toggle}><PanelLeft size={16} /></IconButton>
      {children}
    </div>
  )
}
