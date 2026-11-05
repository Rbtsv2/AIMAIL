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
        <Row label="Taille des textes" hint="S’applique à toute l’interface : menus, listes, messages, réglages."><Segmented value={app.fontSize ?? 'normal'} options={[{ value: 'small', label: 'Petite' }, { value: 'normal', label: 'Normale' }, { value: 'large', label: 'Grande' }]} onChange={(fontSize) => void setApp({ fontSize })} /></Row>
        <Row label="Zone de rédaction" hint="Fond des réponses de l’assistant, du composeur et de la signature. « Claire » montre le message tel que le destinataire le verra ; un mail envoyé n’a pas de couleur de fond, c’est sa messagerie qui décide."><Segmented value={app.composeSurface ?? 'light'} options={[{ value: 'light', label: 'Claire' }, { value: 'theme', label: 'Selon le thème' }]} onChange={(composeSurface) => void setApp({ composeSurface })} /></Row>
        <Row label="Thème"><Segmented value={app.theme} options={[{ value: 'system', label: 'Système' }, { value: 'light', label: 'Clair' }, { value: 'dark', label: 'Sombre' }]} onChange={(theme) => void setApp({ theme })} /></Row>
      </Group>
    </>
  )
}