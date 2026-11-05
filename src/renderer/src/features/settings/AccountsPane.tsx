// src/renderer/src/features/settings/AccountsPane.tsx
import { useState } from 'react'
import { Plus, Trash2, RefreshCw } from 'lucide-react'
import { invoke } from '@/lib/api'
import { useUi } from '@/stores/ui.store'
import { useAccounts } from '@/stores/accounts.store'
import { useSettings } from '@/stores/settings.store'
import { Group, Row, Input, Select, TextArea } from '@/design-system/Field'
import { AddAccountFlow } from '@/features/accounts/AddAccountFlow'

export function AccountsPane() {
  const accounts = useAccounts((s) => s.accounts)
  const update = useAccounts((s) => s.update)
  const remove = useAccounts((s) => s.remove)
  const sigs = useSettings((s) => s.signatures)
  const [adding, setAdding] = useState(false)
  return (
    <>
      <h2>Comptes</h2>
      {accounts.map((a) => (
        <Group key={a.id}>
          <Row label={a.email} hint={a.provider === 'gmail' ? 'Gmail' : a.provider === 'outlook' ? 'Microsoft' : 'IMAP'}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: a.color }} />
            <button className="btn quiet" title="Vider le cache local et tout rapatrier" onClick={() => { useUi.getState().toast({ text: 'Resynchronisation en cours…' }); void invoke('sync:reset', a.id) }}><RefreshCw size={14} /> Resynchroniser</button>
            <button className="icon-btn" aria-label="Retirer ce compte" onClick={() => { if (confirm(`Retirer ${a.email} de cette application ?`)) void remove(a.id) }}><Trash2 size={15} /></button>
          </Row>
          <Row label="Nom d’expéditeur"><Input defaultValue={a.name} onBlur={(e) => e.target.value !== a.name && void update(a.id, { name: e.target.value })} /></Row>
          {a.provider === 'gmail' && a.auth === 'password' && (
            <Row label="Google Agenda et Contacts" hint={a.googleData ? 'Connectés : l’agenda et les contacts de ce compte sont synchronisés.' : 'Le mot de passe d’application ne donne accès qu’aux mails ; autorisez l’agenda et les contacts séparément (sans accès à la messagerie).'}>
              {a.googleData
                ? <button className="btn quiet" onClick={async () => { await invoke('accounts:googleData', a.id, 'disconnect'); await useAccounts.getState().load(); useUi.getState().toast({ text: 'Google Agenda et Contacts déconnectés' }) }}>Déconnecter</button>
                : <button className="btn primary" onClick={async () => { try { useUi.getState().toast({ text: 'Terminez l’autorisation dans votre navigateur…' }); await invoke('accounts:googleData', a.id, 'connect'); await useAccounts.getState().load(); useUi.getState().toast({ text: 'Google Agenda et Contacts connectés' }) } catch (e: any) { useUi.getState().toast({ text: e?.message ?? 'Échec de la connexion' }) } }}>Connecter</button>}
            </Row>
          )}
          <Row label="Signature par défaut">
            <Select value={a.defaultSignatureId ?? ''} onChange={(e) => void update(a.id, { defaultSignatureId: e.target.value || null })}>
              <option value="">Aucune</option>
              {sigs.filter((s) => !s.accountId || s.accountId === a.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              {sigs.some((s) => s.accountId && s.accountId !== a.id) && <optgroup label="Signatures d’autres comptes">
                {sigs.filter((s) => s.accountId && s.accountId !== a.id).map((s) => <option key={s.id} value={s.id}>{s.name} — {accounts.find((x) => x.id === s.accountId)?.email ?? 'autre compte'}</option>)}
              </optgroup>}
            </Select>
          </Row>
          <Row label="Vider les Indésirables" hint="Suppression définitive des messages plus anciens que ce délai sur ce compte.">
            <Select value={a.purgeSpamDays === null || a.purgeSpamDays === undefined ? '' : String(a.purgeSpamDays)} onChange={(e) => void update(a.id, { purgeSpamDays: e.target.value === '' ? null : Number(e.target.value) })}>
              <option value="">Réglage général</option><option value="0">Jamais</option><option value="7">Après 7 jours</option><option value="14">Après 14 jours</option><option value="30">Après 30 jours</option><option value="90">Après 90 jours</option>
            </Select>
          </Row>
          <Row label="Vider la Corbeille">
            <Select value={a.purgeTrashDays === null || a.purgeTrashDays === undefined ? '' : String(a.purgeTrashDays)} onChange={(e) => void update(a.id, { purgeTrashDays: e.target.value === '' ? null : Number(e.target.value) })}>
              <option value="">Réglage général</option><option value="0">Jamais</option><option value="7">Après 7 jours</option><option value="30">Après 30 jours</option><option value="90">Après 90 jours</option>
            </Select>
          </Row>
          <Row column label="Instructions pour l’assistant sur ce compte" hint="Contexte propre à cette boîte : rôle, entreprise, formules à utiliser ou à éviter.">
            <TextArea defaultValue={a.aiInstructions} placeholder="Ex. : Je suis gérant de la société X. Vouvoie les clients, tutoie les collègues, signe toujours « Bien à vous »." onBlur={(e) => e.target.value !== a.aiInstructions && void update(a.id, { aiInstructions: e.target.value })} />
          </Row>
        </Group>
      ))}
      {adding ? <Group><div style={{ padding: 16 }}><AddAccountFlow onDone={() => setAdding(false)} /></div></Group>
        : <button className="btn quiet" onClick={() => setAdding(true)}><Plus size={14} /> Ajouter un compte</button>}
    </>
  )
}