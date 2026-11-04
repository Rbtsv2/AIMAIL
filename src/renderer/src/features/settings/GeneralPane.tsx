// src/renderer/src/features/settings/GeneralPane.tsx
import { useSettings } from '@/stores/settings.store'
import { useEffect, useState } from 'react'
import { invoke } from '@/lib/api'
import { ShieldAlert, X } from 'lucide-react'
import { Switch } from '@/design-system/Switch'
import { Group, Row, Select } from '@/design-system/Field'

function BlockedSenders() {
  const [list, setList] = useState<{ address: string; createdAt: number }[]>([])
  const load = () => void invoke('blocked:list').then(setList)
  useEffect(load, [])
  if (!list.length) return <div className="frow" style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)' }}>Aucun expéditeur bloqué. Signaler un message comme indésirable ajoute son expéditeur ici.</div>
  return <div className="frow col"><div className="check-list">{list.map((b) => <span key={b.address} className="check-chip on"><ShieldAlert size={12} /> {b.address} <button className="icon-btn" style={{ width: 18, height: 18 }} title="Débloquer" onClick={async () => { await invoke('blocked:remove', b.address); load() }}><X size={12} /></button></span>)}</div></div>
}

export function GeneralPane() {
  const app = useSettings((s) => s.app)
  const setApp = useSettings((s) => s.setApp)
  if (!app) return null
  return (
    <>
      <h2>Général</h2>
      <Group>
        <Row label="Charger les images distantes" hint="Affiche directement les images des messages. Désactivé, les expéditeurs ne peuvent pas savoir si vous avez ouvert le message."><Switch on={app.loadRemoteImages} onChange={(v) => void setApp({ loadRemoteImages: v })} /></Row>
        <Row label="Vider automatiquement les Indésirables" hint="Réglage par défaut, modifiable compte par compte dans Comptes.">
          <Select value={String(app.purgeSpamDays ?? 0)} onChange={(e) => void setApp({ purgeSpamDays: Number(e.target.value) })}>
            <option value="0">Jamais</option><option value="7">Après 7 jours</option><option value="14">Après 14 jours</option><option value="30">Après 30 jours</option><option value="90">Après 90 jours</option>
          </Select>
        </Row>
        <Row label="Vider automatiquement la Corbeille" hint="Même principe pour la Corbeille.">
          <Select value={String(app.purgeTrashDays ?? 0)} onChange={(e) => void setApp({ purgeTrashDays: Number(e.target.value) })}>
            <option value="0">Jamais</option><option value="7">Après 7 jours</option><option value="30">Après 30 jours</option><option value="90">Après 90 jours</option>
          </Select>
        </Row>
        <Row label="Expéditeurs bloqués" hint="Leurs messages vont directement dans Indésirables, sans passer par la réception." column><BlockedSenders /></Row>
        <Row label="Confirmer avant d’envoyer" hint="Récapitulatif des destinataires, de l’objet et des pièces jointes avant chaque envoi (Entrée pour confirmer)."><Switch on={app.confirmSend !== false} onChange={(v) => void setApp({ confirmSend: v })} /></Row>
        <Row label="Indexer le contenu complet des messages" hint="Télécharge progressivement le texte de tous les messages en arrière-plan : la recherche et l’assistant voient le contenu entier, pas seulement l’aperçu."><Switch on={app.fullTextIndex !== false} onChange={(v) => void setApp({ fullTextIndex: v })} /></Row>
        <Row label="Collecter les adresses des messages" hint="Les expéditeurs et destinataires de vos messages alimentent les contacts, pour les proposer à la saisie."><Switch on={app.collectAddresses !== false} onChange={(v) => void setApp({ collectAddresses: v })} /></Row>
        <Row label="Délai avant « lu »" hint="Temps d’affichage avant qu’un message soit marqué comme lu.">
          <Select value={app.markReadDelayMs} onChange={(e) => void setApp({ markReadDelayMs: +e.target.value })}><option value={0}>Immédiat</option><option value={800}>Moins d’une seconde</option><option value={2000}>2 secondes</option><option value={999999999}>Jamais</option></Select>
        </Row>
        <Row label="Annuler l’envoi" hint="Fenêtre pendant laquelle un message envoyé peut être rappelé.">
          <Select value={app.undoSendSeconds} onChange={(e) => void setApp({ undoSendSeconds: +e.target.value })}><option value={0}>Désactivé</option><option value={5}>5 secondes</option><option value={10}>10 secondes</option><option value={30}>30 secondes</option></Select>
        </Row>
      </Group>
    </>
  )
}