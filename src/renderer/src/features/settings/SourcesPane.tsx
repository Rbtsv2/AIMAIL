// src/renderer/src/features/settings/SourcesPane.tsx
import { useEffect, useState } from 'react'
import { Plus, Trash2, Globe, FileText, Plug, RefreshCw, FolderOpen } from 'lucide-react'
import type { Source, SourceInput, SourceKind, SourceAuthKind } from '@shared/models/Source'
import { invoke } from '@/lib/api'
import { useAccounts } from '@/stores/accounts.store'
import { useAi } from '@/stores/ai.store'
import { useUi } from '@/stores/ui.store'
import { Group, Row, Input, Select, TextArea } from '@/design-system/Field'
import { Switch } from '@/design-system/Switch'
import { Segmented } from '@/design-system/Segmented'

const KIND_LABEL: Record<SourceKind, string> = { url: 'Page web', file: 'Fichier', api: 'API' }
const KIND_ICON: Record<SourceKind, typeof Globe> = { url: Globe, file: FileText, api: Plug }
const AUTH_LABEL: Record<SourceAuthKind, string> = { none: 'Aucune', basic: 'Login / mot de passe', bearer: 'Jeton (Bearer)', header: 'En-tête personnalisé', cookie: 'Cookie de session' }

const blank = (kind: SourceKind, accountIds: string[] = []): SourceInput => ({ id: '', accountIds, kind, name: '', description: '', urls: [''], method: 'GET', bodyTemplate: '', authKind: 'none', filePath: '', enabled: true, secret: {} })
const isUrl = (u: string) => /^https?:\/\/\S+/i.test(u.trim())

export function SourcesPane() {
  const accounts = useAccounts((s) => s.accounts)
  const ai = useAi((s) => s.settings)
  const saveAi = useAi((s) => s.save)
  const toast = useUi((s) => s.toast)
  const [list, setList] = useState<Source[]>([])
  const [edit, setEdit] = useState<SourceInput | null>(null)
  const [testing, setTesting] = useState<{ ok: boolean; preview?: string; error?: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = async () => setList(await invoke('sources:list'))
  useEffect(() => { void reload() }, [])

  const save = async () => {
    if (!edit || !edit.name.trim()) return
    setBusy(true)
    try {
      const saved = await invoke('sources:save', { ...edit, urls: edit.urls.map((u) => u.trim()).filter(Boolean) })
      const t = await invoke('sources:test', saved.id)
      setTesting(t)
      await reload()
      if (t.ok) { toast({ text: `${saved.name} : source vérifiée` }); setEdit(null); setTesting(null) }
    } catch (e: any) { toast({ text: String(e?.message ?? e), ttl: 6000 }) }
    finally { setBusy(false) }
  }

  return (
    <>
      <h2>Sources</h2>
      <p style={{ color: 'var(--text-2)', margin: '-8px 0 18px', fontSize: 'var(--fs-sm)' }}>Documents, pages et API que l’assistant peut consulter pour répondre : un bail type, une grille tarifaire, votre espace client, une base interne. Les identifiants restent chiffrés sur cet ordinateur ; l’assistant ne voit que le contenu récupéré.</p>
      {ai && <Group><Row label="Autoriser l’assistant à consulter les sources" hint="Uniquement sur vos demandes explicites, jamais en classement ou réponse automatique."><Switch on={ai.allowSources} onChange={(allowSources) => void saveAi({ allowSources })} /></Row></Group>}

      <Group>
        {list.length === 0 && <div className="frow" style={{ color: 'var(--text-2)' }}>Aucune source pour l’instant.</div>}
        {list.map((s) => {
          const Icon = KIND_ICON[s.kind]
          return (
            <Row key={s.id} label={s.name} hint={`${KIND_LABEL[s.kind]} · ${s.accountIds.length ? s.accountIds.map((id) => accounts.find((a) => a.id === id)?.email ?? '?').join(', ') : 'aucun compte (inactive)'}${s.urls.length > 1 ? ` · ${s.urls.length} URL` : ''}${s.cachedAt ? ` · lu ${new Date(s.cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}`}>
              <Icon size={15} style={{ color: 'var(--text-2)' }} />
              <Switch on={s.enabled} onChange={async (enabled) => { await invoke('sources:save', { ...s, enabled }); await reload() }} />
              <button className="icon-btn" aria-label="Relire" title="Relire maintenant" onClick={async () => { const t = await invoke('sources:test', s.id); toast({ text: t.ok ? `${s.name} relue` : `${s.name} : ${t.error}`, ttl: t.ok ? 2500 : 7000 }); await reload() }}><RefreshCw size={15} /></button>
              <button className="btn quiet" onClick={() => { setEdit({ ...s, secret: {} }); setTesting(null) }}>Modifier</button>
              <button className="icon-btn" aria-label="Supprimer" onClick={async () => { if (confirm(`Supprimer la source « ${s.name} » ?`)) { await invoke('sources:delete', s.id); await reload() } }}><Trash2 size={15} /></button>
            </Row>
          )
        })}
      </Group>

      {edit ? (
        <Group>
          <Row label="Type"><Segmented value={edit.kind} options={(['url', 'file', 'api'] as SourceKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))} onChange={(kind) => setEdit({ ...edit, kind })} /></Row>
          <Row label="Nom" hint="Court et parlant, l’assistant s’en sert pour choisir."><Input value={edit.name} placeholder="Ex. : Grille des loyers 2026" onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Row>
          <Row column label="Description pour l’assistant" hint="Ce qu’on y trouve et quand la consulter.">
            <TextArea value={edit.description} style={{ minHeight: 64 }} placeholder="Ex. : loyers et charges par appartement, échéances, indexations. Consulter pour toute question d’un locataire sur un montant." onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
          </Row>
          <Row column label="Comptes concernés" hint={edit.accountIds.length ? '' : 'Cochez au moins un compte, sinon la source ne sera jamais utilisée.'}>
            <div className="check-list">
              <button className="check-chip" onClick={() => setEdit({ ...edit, accountIds: edit.accountIds.length === accounts.length ? [] : accounts.map((a) => a.id) })}>{edit.accountIds.length === accounts.length ? 'Tout décocher' : 'Tout cocher'}</button>
              {accounts.map((a) => { const on = edit.accountIds.includes(a.id); return (
                <button key={a.id} className={`check-chip ${on ? 'on' : ''}`} onClick={() => setEdit({ ...edit, accountIds: on ? edit.accountIds.filter((x) => x !== a.id) : [...edit.accountIds, a.id] })}>
                  <span className="dot" style={{ background: a.color }} />{a.email}
                </button>) })}
            </div>
          </Row>

          {edit.kind === 'file' && (
            <Row label="Fichier" hint="PDF, Word, texte, Markdown, CSV, JSON ou HTML.">
              <Input value={edit.filePath} readOnly placeholder="Aucun fichier choisi" style={{ minWidth: 260 }} />
              <button className="btn quiet" onClick={async () => { const p = await invoke('sources:pickFile'); if (p) setEdit({ ...edit, filePath: p, name: edit.name || p.split(/[\\/]/).pop()!.replace(/\.[^.]+$/, '') }) }}><FolderOpen size={14} /> Choisir</button>
            </Row>
          )}

          {edit.kind !== 'file' && (
            <Row column label={edit.urls.length > 1 ? 'URL (même authentification pour toutes)' : 'URL'} hint={edit.kind === 'api' ? 'Utilisez {query} là où insérer la recherche. Plusieurs URL sont lues et combinées.' : 'Les pages sont lues, combinées et mises en cache 6 h.'}>
              <div className="url-list">
                {edit.urls.map((u, i) => (
                  <div key={i} className="url-row">
                    <Input value={u} placeholder={edit.kind === 'api' ? 'https://api.exemple.fr/search?q={query}' : 'https://exemple.fr/tarifs'} style={{ flex: 1 }} onChange={(e) => { const urls = [...edit.urls]; urls[i] = e.target.value; setEdit({ ...edit, urls }) }} />
                    {edit.urls.length > 1 && <button className="icon-btn" aria-label="Retirer" onClick={() => setEdit({ ...edit, urls: edit.urls.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>}
                  </div>
                ))}
                <button className="btn quiet" style={{ alignSelf: 'flex-start' }} onClick={() => setEdit({ ...edit, urls: [...edit.urls, ''] })}><Plus size={14} /> Ajouter une URL</button>
              </div>
            </Row>
          )}

          {edit.kind === 'api' && <>
            <Row label="Méthode"><Segmented value={edit.method} options={[{ value: 'GET', label: 'GET' }, { value: 'POST', label: 'POST' }]} onChange={(method) => setEdit({ ...edit, method })} /></Row>
            {edit.method === 'POST' && <Row column label="Corps JSON" hint="{query} est remplacé par la recherche."><TextArea value={edit.bodyTemplate} style={{ minHeight: 64, fontFamily: 'var(--font-mono)' }} placeholder='{"search": "{query}", "limit": 20}' onChange={(e) => setEdit({ ...edit, bodyTemplate: e.target.value })} /></Row>}
          </>}

          {edit.kind !== 'file' && <>
            <Row label="Authentification">
              <Select value={edit.authKind} onChange={(e) => setEdit({ ...edit, authKind: e.target.value as SourceAuthKind })}>
                {(Object.keys(AUTH_LABEL) as SourceAuthKind[]).map((k) => <option key={k} value={k}>{AUTH_LABEL[k]}</option>)}
              </Select>
            </Row>
            {edit.authKind === 'basic' && <Row label="Identifiants">
              <Input placeholder="Login" value={edit.secret?.username ?? ''} onChange={(e) => setEdit({ ...edit, secret: { ...edit.secret, username: e.target.value } })} />
              <Input placeholder={edit.id ? 'Mot de passe (inchangé si vide)' : 'Mot de passe'} type="password" value={edit.secret?.password ?? ''} onChange={(e) => setEdit({ ...edit, secret: { ...edit.secret, password: e.target.value } })} />
            </Row>}
            {edit.authKind === 'bearer' && <Row label="Jeton"><Input type="password" placeholder={edit.id ? 'Inchangé si vide' : 'Coller le jeton'} value={edit.secret?.token ?? ''} style={{ minWidth: 320 }} onChange={(e) => setEdit({ ...edit, secret: { ...edit.secret, token: e.target.value } })} /></Row>}
            {edit.authKind === 'header' && <Row label="En-tête">
              <Input placeholder="X-API-Key" value={edit.secret?.headerName ?? ''} onChange={(e) => setEdit({ ...edit, secret: { ...edit.secret, headerName: e.target.value } })} />
              <Input type="password" placeholder="Valeur" value={edit.secret?.headerValue ?? ''} onChange={(e) => setEdit({ ...edit, secret: { ...edit.secret, headerValue: e.target.value } })} />
            </Row>}
            {edit.authKind === 'cookie' && <Row column label="Cookie" hint="Copié depuis les outils de développement du navigateur après connexion (en-tête Cookie)."><TextArea value={edit.secret?.cookie ?? ''} style={{ minHeight: 56, fontFamily: 'var(--font-mono)' }} placeholder="session=abc123; csrftoken=…" onChange={(e) => setEdit({ ...edit, secret: { ...edit.secret, cookie: e.target.value } })} /></Row>}
          </>}

          {testing && <div className="frow" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            {testing.ok
              ? <><span style={{ color: '#2eaf8a', fontSize: 'var(--fs-sm)' }}>Lecture réussie — aperçu :</span><pre style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', fontSize: 'var(--fs-xs)', color: 'var(--text-2)', maxHeight: 120, overflow: 'auto', fontFamily: 'var(--font)' }}>{testing.preview}</pre></>
              : <span className="err">Échec : {testing.error}</span>}
          </div>}

          <div className="frow" style={{ justifyContent: 'flex-end' }}>
            <button className="btn quiet" onClick={() => { setEdit(null); setTesting(null) }}>Annuler</button>
            <button className="btn primary" disabled={busy || !edit.name.trim() || !edit.accountIds.length || (edit.kind === 'file' ? !edit.filePath : !edit.urls.some(isUrl))} onClick={() => void save()}>{busy ? 'Vérification…' : 'Enregistrer et tester'}</button>
          </div>
        </Group>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn quiet" onClick={() => setEdit(blank('url'))}><Plus size={14} /> Page web</button>
          <button className="btn quiet" onClick={() => setEdit(blank('file'))}><Plus size={14} /> Fichier</button>
          <button className="btn quiet" onClick={() => setEdit(blank('api'))}><Plus size={14} /> API</button>
        </div>
      )}
    </>
  )
}