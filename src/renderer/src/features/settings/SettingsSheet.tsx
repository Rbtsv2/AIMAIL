// src/renderer/src/features/settings/SettingsSheet.tsx
import { Sliders, UserCircle, PenTool, Sparkles, Palette, Database, HardDriveDownload, X } from 'lucide-react'
import { useUi } from '@/stores/ui.store'
import { IconButton } from '@/design-system/IconButton'
import { GeneralPane } from './GeneralPane'
import { AccountsPane } from './AccountsPane'
import { SignaturesPane } from './SignaturesPane'
import { AiPane } from './AiPane'
import { AppearancePane } from './AppearancePane'
import { SourcesPane } from './SourcesPane'
import { BackupPane } from './BackupPane'

const NAV = [
  { id: 'general', label: 'Général', icon: Sliders, el: GeneralPane },
  { id: 'accounts', label: 'Comptes', icon: UserCircle, el: AccountsPane },
  { id: 'signatures', label: 'Signatures', icon: PenTool, el: SignaturesPane },
  { id: 'ai', label: 'Assistant', icon: Sparkles, el: AiPane },
  { id: 'sources', label: 'Sources', icon: Database, el: SourcesPane },
  { id: 'appearance', label: 'Apparence', icon: Palette, el: AppearancePane },
  { id: 'backup', label: 'Sauvegarde & import', icon: HardDriveDownload, el: BackupPane }
] as const

export function SettingsPage() {
  const pane = useUi((s) => s.settingsPane)
  const openSettings = useUi((s) => s.openSettings)
  const close = useUi((s) => s.closeSettings)
  const Pane = NAV.find((n) => n.id === pane)?.el ?? GeneralPane
  return (
    <section className="settings-page">
      <div className="pane-head drag" style={{ justifyContent: 'flex-start', paddingLeft: 20 }}>
        <span style={{ fontWeight: 600, fontSize: 'var(--fs-lg)' }}>Réglages</span>
        <div style={{ flex: 1 }} />
        <IconButton label="Fermer les réglages (Échap)" onClick={close}><X size={16} /></IconButton>
      </div>
      <div className="settings">
        <nav className="settings-nav">
          {NAV.map((n) => <button key={n.id} className={`sidebar-item ${pane === n.id ? 'active' : ''}`} onClick={() => openSettings(n.id)}><n.icon size={15} /><span className="label">{n.label}</span></button>)}
        </nav>
        <div className="settings-pane"><Pane /></div>
      </div>
    </section>
  )
}