// src/renderer/src/features/settings/AiPane.tsx
import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useAi } from '@/stores/ai.store'
import { Switch } from '@/design-system/Switch'
import { Segmented } from '@/design-system/Segmented'
import { Group, Row, Input, Select } from '@/design-system/Field'
import { AiInstructionsEditor } from './AiInstructionsEditor'
import type { AiProviderKind } from '@shared/ai/AiProvider'
import { useAccounts } from '@/stores/accounts.store'

const KIND_LABEL: Record<AiProviderKind, string> = { ollama: 'Ollama (local)', anthropic: 'Claude', openai: 'OpenAI' }

export function AiPane() {
  const s = useAi((x) => x.settings)
  const models = useAi((x) => x.models)
  const healthy = useAi((x) => x.healthy)
  const save = useAi((x) => x.save)
  const setKey = useAi((x) => x.setKey)
  const refresh = useAi((x) => x.refreshModels)
  const [key, setKeyLocal] = useState('')
  const accounts = useAccounts((x) => x.accounts)
  useEffect(() => {
    void refresh()
    const t = setInterval(() => void refresh(), 15000)
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus) }
  }, [s?.provider.kind, s?.provider.baseUrl])
  if (!s) return null
  const k = s.provider.kind
  return (
    <>
      <h2>Assistant</h2>
      <Group>
        <Row label="Activer l’assistant" hint="Affiche la barre d’actions dans la lecture et la rédaction."><Switch on={s.enabled} onChange={(enabled) => void save({ enabled })} /></Row>
      </Group>
      <Group>
        <Row label="Moteur" hint={k === 'ollama' ? 'Rien ne quitte votre ordinateur.' : 'Le contenu des mails est envoyé à ce fournisseur.'}>
          <Segmented value={k} options={(['ollama', 'anthropic', 'openai'] as AiProviderKind[]).map((v) => ({ value: v, label: KIND_LABEL[v] }))}
            onChange={(kind) => void save({ provider: { kind, model: kind === 'ollama' ? 'llama3.1' : kind === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4o-mini', baseUrl: kind === 'ollama' ? 'http://127.0.0.1:11434' : undefined } })} />
        </Row>
        {k === 'ollama'
          ? <Row label="Adresse d’Ollama"><Input defaultValue={s.provider.baseUrl} onBlur={(e) => void save({ provider: { ...s.provider, baseUrl: e.target.value } })} /></Row>
          : <Row label="Clé API" hint={s.provider.hasKey ? 'Une clé est enregistrée.' : 'Aucune clé enregistrée.'}>
              <Input type="password" placeholder={s.provider.hasKey ? '••••••••' : 'Coller la clé'} value={key} onChange={(e) => setKeyLocal(e.target.value)} onBlur={() => { if (key) { void setKey(k, key); setKeyLocal('') } }} />
            </Row>}
        <Row label="Modèle" hint={healthy === false ? 'Impossible de joindre le moteur.' : healthy ? `${models.length} modèles disponibles` : ''}>
          {models.length
            ? <Select value={s.provider.model} onChange={(e) => void save({ provider: { ...s.provider, model: e.target.value } })}>{!models.some((m) => m.id === s.provider.model) && <option value={s.provider.model}>{s.provider.model} (introuvable)</option>}{models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</Select>
            : <Input defaultValue={s.provider.model} onBlur={(e) => void save({ provider: { ...s.provider, model: e.target.value } })} />}
          <button className="icon-btn" aria-label="Rafraîchir" onClick={() => void refresh()}><RefreshCw size={15} /></button>
        </Row>
        <Row label="Vérifier les faits avant d’afficher" hint="Une relecture remplace par [à compléter] tout ce que le fil ne contient pas (clauses, montants, dates, références). Double le temps de génération."><Switch on={s.verifyFacts} onChange={(verifyFacts) => void save({ verifyFacts })} /></Row>
        <Row label="Proposer une réponse à l’ouverture" hint="Dès qu’un message reçu est ouvert, une réponse est rédigée et peut être envoyée en un clic (ou modifiée avant)."><Switch on={s.autoReply} onChange={(autoReply) => void save({ autoReply })} /></Row>
        <Row label="Laisser l’assistant chercher dans les messages" hint="Pour répondre à une question, l’assistant peut rechercher et lire vos e-mails (jamais en automatique)."><Switch on={s.mailSearch} onChange={(mailSearch) => void save({ mailSearch })} /></Row>
        {s.mailSearch && <Row column label="Comptes consultables" hint={s.mailSearchAccountIds.length ? `${s.mailSearchAccountIds.length} compte${s.mailSearchAccountIds.length > 1 ? 's' : ''} autorisé${s.mailSearchAccountIds.length > 1 ? 's' : ''}.` : 'Aucun compte coché : l’assistant ne lira aucun message.'}>
          <div className="check-list">
            <button className="check-chip" onClick={() => void save({ mailSearchAccountIds: s.mailSearchAccountIds.length === accounts.length ? [] : accounts.map((a) => a.id) })}>{s.mailSearchAccountIds.length === accounts.length ? 'Tout décocher' : 'Tout cocher'}</button>
            {accounts.map((a) => { const on = s.mailSearchAccountIds.includes(a.id); return <button key={a.id} className={`check-chip ${on ? 'on' : ''}`} onClick={() => void save({ mailSearchAccountIds: on ? s.mailSearchAccountIds.filter((x) => x !== a.id) : [...s.mailSearchAccountIds, a.id] })}><span className="dot" style={{ background: a.color }} />{a.email}</button> })}
          </div>
        </Row>}
        <Row label="Détecter les événements dans les messages" hint="Rendez-vous, réunions, convocations décrits dans le texte : une carte propose de les ajouter à l’agenda."><Switch on={s.detectEvents} onChange={(detectEvents) => void save({ detectEvents })} /></Row>
        <Row label="Rythme des tâches de fond" hint="Réponses préparées et classification. « Espacé » laisse 20 s entre deux générations (machine plus silencieuse) ; « La nuit » reporte le travail automatique entre 22 h et 7 h — un lancement manuel s’exécute toujours tout de suite.">
          <Segmented value={s.pace ?? 'continuous'} options={[{ value: 'continuous', label: 'Continu' }, { value: 'paced', label: 'Espacé' }, { value: 'night', label: 'La nuit' }]} onChange={(pace) => void save({ pace })} />
        </Row>
        <Row label="Classer automatiquement les nouveaux messages" hint="Chaque message reçu est étiqueté en arrière-plan : urgent, action, information, newsletter ou spam."><Switch on={s.autoClassify} onChange={(autoClassify) => void save({ autoClassify })} /></Row>
        {k !== 'ollama' && <Row label="Masquer les données sensibles avant envoi" hint="Adresses e-mail, téléphones et IBAN sont remplacés par des jetons, puis restaurés dans la réponse."><Switch on={s.redactBeforeCloud} onChange={(redactBeforeCloud) => void save({ redactBeforeCloud })} /></Row>}
      </Group>
      <Group>
        <Row label="Ton par défaut"><Segmented value={s.tone} options={[{ value: 'neutre', label: 'Neutre' }, { value: 'formel', label: 'Formel' }, { value: 'amical', label: 'Amical' }, { value: 'direct', label: 'Direct' }]} onChange={(tone) => void save({ tone })} /></Row>
        <Row label="Langue des réponses"><Segmented value={s.replyLanguage} options={[{ value: 'auto', label: 'Celle du fil' }, { value: 'fr', label: 'Français' }, { value: 'en', label: 'Anglais' }]} onChange={(replyLanguage) => void save({ replyLanguage })} /></Row>
      </Group>
      <AiInstructionsEditor />
    </>
  )
}