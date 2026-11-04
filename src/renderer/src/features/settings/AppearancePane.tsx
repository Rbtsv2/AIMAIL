// src/renderer/src/features/settings/AppearancePane.tsx
import { useSettings } from '@/stores/settings.store'
import { Segmented } from '@/design-system/Segmented'
import { Group, Row } from '@/design-system/Field'

export function AppearancePane() {
  const app = useSettings((s) => s.app)
  const setApp = useSettings((s) => s.setApp)
  if (!app) return null
  return (
    <>
      <h2>Apparence</h2>
      <Group>
        <Row label="Thème"><Segmented value={app.theme} options={[{ value: 'system', label: 'Système' }, { value: 'light', label: 'Clair' }, { value: 'dark', label: 'Sombre' }]} onChange={(theme) => void setApp({ theme })} /></Row>
      </Group>
    </>
  )
}