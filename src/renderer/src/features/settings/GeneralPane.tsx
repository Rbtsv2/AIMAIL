// src/renderer/src/features/settings/GeneralPane.tsx
import { useSettings } from '@/stores/settings.store'
import { useEffect, useState } from 'react'
import { invoke } from '@/lib/api'
import { ShieldAlert, X, RefreshCw, Download } from 'lucide-react'
import { useUpdate } from '@/stores/update.store'
import { useMuted } from '@/stores/muted.store'
import { Switch } from '@/design-system/Switch'
import { Group, Row, Select } from '@/design-system/Field'

function MutedSenders() {
  const [list, setList] = useState<{ address: string; createdAt: number }[]>([])
  const load = () => void invoke('muted:list').then(setList)
  useEffect(load, [])
  if (!list.length) return <div className="frow" style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)' }}>Aucun. Dans un message, l’interrupteur à côté de l’adresse de l’expéditeur permet de l’exclure.</div>
  return <div className="frow col"><div className="check-list">{list.map((b) => <span key={b.address} className="check-chip on">{b.address} <button className="icon-btn" style={{ width: 18, height: 18 }} title="Réactiver" onClick={async () => { await invoke('muted:remove', b.address); load(); void useMuted.getState().load() }}><X size={12} /></button></span>)}</div></div>
}

function BlockedSenders() {
  const [list, setList] = useState<{ address: string; createdAt: number }[]>([])
  const load = () => void invoke('blocked:list').then(setList)
  useEffect(load, [])
  if (!list.length) return <div className="frow" style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)' }}>Aucun expéditeur bloqué. Signaler un message comme indésirable ajoute son expéditeur ici.</div>
  return <div className="frow col"><div className="check-list">{list.map((b) => <span key={b.address} className="check-chip on"><ShieldAlert size={12} /> {b.address} <button className="icon-btn" style={{ width: 18, height: 18 }} title="Débloquer" onClick={async () => { await invoke('blocked:remove', b.address); load() }}><X size={12} /></button></span>)}</div></div>
}

function UpdateRow() {
  const u = useUpdate((s) => s.state)
  const check = useUpdate((s) => s.check)
  const install = useUpdate((s) => s.install)
  const label = u.status === 'disabled' ? 'Mises à jour automatiques indisponibles en mode développement'
    : u.status === 'checking' ? 'Recherche d’une mise à jour…'
    : u.status === 'downloading' ? `Téléchargement de la version ${u.version}… ${u.progress ?? 0} %`
    : u.status === 'ready' ? `Version ${u.version} téléchargée — redémarrez pour l’installer`
    : u.status === 'error' ? `Erreur : ${u.error}`
    : u.status === 'up-to-date' ? `À jour (${u.current})${u.checkedAt ? ` · vérifié à ${new Date(u.checkedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}`
    : `Version ${u.current}`
  return (
    <div className="frow" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 'var(--fs-sm)', color: u.status === 'error' ? '#d9822b' : 'var(--text-2)', flex: 1 }}>{label}</span>
      {u.status === 'ready'
        ? <button className="btn primary" onClick={() => void install()}><Download size={14} /> Redémarrer et installer</button>
        : <button className="btn quiet" disabled={u.status === 'checking' || u.status === 'downloading' || u.status === 'disabled'} onClick={() => void check()}><RefreshCw size={14} /> Vérifier maintenant</button>}
    </div>
  )
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
        <Row label="Mises à jour" hint="Vérification au démarrage puis toutes les 6 heures ; la mise à jour s’installe au redémarrage." column><UpdateRow /></Row>
        <Row label="Mettre à jour automatiquement"><Switch on={app.autoUpdate !== false} onChange={(v) => void setApp({ autoUpdate: v })} /></Row>
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
        <Row label="Sans réponse préparée" hint="L’assistant ne rédige jamais de réponse pour ces expéditeurs." column><MutedSenders /></Row>
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