// src/renderer/src/features/settings/SignaturesPane.tsx
import { useState } from 'react'
import { Plus, Trash2, Code2, Eye } from 'lucide-react'
import { Segmented } from '@/design-system/Segmented'
import { cleanSignatureHtml, signatureText } from '@shared/signature'
import { HtmlEditor } from './HtmlEditor'
import { TEMPLATES, type SigVars } from './signatureTemplates'
import { invoke } from '@/lib/api'
import { shrinkImage } from '@/lib/image'
import { LayoutTemplate, Image as ImageIcon, Undo2 } from 'lucide-react'
import { Wand2 } from 'lucide-react'
import type { Signature } from '@shared/models/Signature'
import { useSettings } from '@/stores/settings.store'
import { useAccounts } from '@/stores/accounts.store'
import { Group, Row, Input, Select } from '@/design-system/Field'

export function SignaturesPane() {
  const sigs = useSettings((s) => s.signatures)
  const save = useSettings((s) => s.saveSignature)
  const del = useSettings((s) => s.deleteSignature)
  const accounts = useAccounts((s) => s.accounts)
  const [edit, setEdit] = useState<Signature | null>(null)
  const [mode, setMode] = useState<'visual' | 'html'>('visual')
  const [tpl, setTpl] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const remember = (html: string) => setHistory((h) => [...h.slice(-19), html])
  const undo = () => { if (!history.length) return; const prev = history[history.length - 1]; setHistory((h) => h.slice(0, -1)); setEdit((e) => e ? { ...e, html: prev, text: signatureText(prev) } : e); setMode('visual') }
  const [vars, setVars] = useState<SigVars>({ name: '', role: '', company: '', email: '', phone: '', site: '', address: '', accent: '#4f6bed', logo: '' })
  const openTemplates = () => { const a = accounts.find((x) => x.id === edit?.accountId) ?? accounts[0]; setVars((v) => ({ ...v, name: v.name || a?.name || '', email: v.email || a?.email || '' })); setTpl(true) }
  const applyTemplate = (id: string) => { if (edit) remember(edit.html); const t = TEMPLATES.find((x) => x.id === id)!; const html = t.build({ ...vars, role: vars.role || 'Fonction', company: vars.company || 'Société', phone: vars.phone || '+33 6 00 00 00 00', site: vars.site || 'https://exemple.fr', address: vars.address || 'Adresse' }); setEdit((e) => e ? { ...e, html, text: signatureText(html) } : e); setMode('visual'); setTpl(false) }

  const blank = (): Signature => ({ id: '', name: 'Nouvelle signature', html: '', text: '', accountId: null })
  return (
    <>
      <h2>Signatures</h2>
      <Group>
        {sigs.length === 0 && <div className="frow" style={{ color: 'var(--text-2)' }}>Aucune signature pour l’instant.</div>}
        {sigs.map((s) => (
          <Row key={s.id} label={s.name} hint={s.accountId ? accounts.find((a) => a.id === s.accountId)?.email : 'Tous les comptes'}>
            <button className="btn quiet" onClick={() => { const needs = /\\n|<!DOCTYPE|<html/i.test(s.html); const html = needs ? cleanSignatureHtml(s.html) : s.html; setEdit(needs ? { ...s, html, text: signatureText(html) } : s); setMode('visual') }}>Modifier</button>
            <button className="icon-btn" aria-label="Supprimer" onClick={() => void del(s.id)}><Trash2 size={15} /></button>
          </Row>
        ))}
      </Group>
      {edit ? (
        <Group>
          <Row label="Nom"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Row>
          <Row label="Compte">
            <Select value={edit.accountId ?? ''} onChange={(e) => setEdit({ ...edit, accountId: e.target.value || null })}>
              <option value="">Tous les comptes</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.email}</option>)}
            </Select>
          </Row>
          <Row label="Modèles" hint="Trois mises en page prêtes à l’emploi, compatibles Gmail, Outlook et iPhone. Le résultat reste modifiable.">
            {history.length > 0 && <button className="btn quiet" onClick={undo} title="Revenir à la version précédente"><Undo2 size={14} /> Revenir en arrière</button>}
            <button className="btn quiet" onClick={() => (tpl ? setTpl(false) : openTemplates())}><LayoutTemplate size={14} /> {tpl ? 'Fermer' : 'Choisir un modèle'}</button>
          </Row>
          {tpl && (
            <div className="frow col">
              <div className="tpl-vars">
                <Input placeholder="Nom" value={vars.name} onChange={(e) => setVars({ ...vars, name: e.target.value })} />
                <Input placeholder="Fonction" value={vars.role} onChange={(e) => setVars({ ...vars, role: e.target.value })} />
                <Input placeholder="Société" value={vars.company} onChange={(e) => setVars({ ...vars, company: e.target.value })} />
                <Input placeholder="E-mail" value={vars.email} onChange={(e) => setVars({ ...vars, email: e.target.value })} />
                <Input placeholder="Téléphone" value={vars.phone} onChange={(e) => setVars({ ...vars, phone: e.target.value })} />
                <Input placeholder="Site web" value={vars.site} onChange={(e) => setVars({ ...vars, site: e.target.value })} />
                <Input placeholder="Adresse" value={vars.address} onChange={(e) => setVars({ ...vars, address: e.target.value })} style={{ gridColumn: 'span 2' }} />
                <label className="tpl-accent">Couleur <input type="color" value={vars.accent} onChange={(e) => setVars({ ...vars, accent: e.target.value })} /></label>
                <button className="btn quiet" onClick={async () => { const raw = await invoke('compose:pickImage'); if (raw) setVars({ ...vars, logo: await shrinkImage(raw, 300) }) }}><ImageIcon size={14} /> {vars.logo ? 'Changer la photo' : 'Photo ou logo'}</button>
              </div>
              <div className="tpl-grid">
                {TEMPLATES.map((t) => (
                  <button key={t.id} className="tpl-card" onClick={() => applyTemplate(t.id)}>
                    <iframe title={t.name} sandbox="" srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:10px;background:#fff;zoom:.62;pointer-events:none}</style></head><body>${t.build({ ...vars, name: vars.name || 'Charles Fournier', role: vars.role || 'Gérant', company: vars.company || 'SCI Sunny Side Estate', email: vars.email || 'contact@exemple.fr', phone: vars.phone || '+33 6 70 50 28 91', site: vars.site || 'https://exemple.fr', address: vars.address || '11 chemin Bellegarrigues, 31140 Aucamville' })}</body></html>`} />
                    <span className="tpl-name">{t.name}</span><span className="tpl-desc">{t.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <Row label="Mode" hint={mode === 'html' ? 'Le code est conservé tel quel.' : 'Rendu réel, éditable en place : mise en page, styles et images conservés.'}>
            <Segmented value={mode} options={[{ value: 'visual', label: 'Éditeur' }, { value: 'html', label: 'HTML' }]} onChange={setMode} />
          </Row>
          {mode === 'visual' ? (
            <div className="frow col"><HtmlEditor key={edit.id || 'new'} html={edit.html} onChange={(html) => setEdit({ ...edit, html, text: signatureText(html) })} /></div>
          ) : (
            <div className="frow col">
              <div className="sig-split">
                <div className="sig-code"><div className="sig-cap"><Code2 size={12} /> Code HTML <button className="btn quiet" style={{ height: 22, marginLeft: 'auto', fontSize: 'var(--fs-xs)' }} title="Retire l’enveloppe de document, les styles de page et les \\n littéraux" onClick={() => { remember(edit.html); const html = cleanSignatureHtml(edit.html); setEdit({ ...edit, html, text: signatureText(html) }) }}><Wand2 size={12} /> Nettoyer</button></div><textarea className="field" style={{ minHeight: 220, fontFamily: 'var(--font-mono)', fontSize: 12, width: '100%' }} value={edit.html} onChange={(e) => setEdit({ ...edit, html: e.target.value, text: e.target.value.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim() })} /></div>
                <div className="sig-preview"><div className="sig-cap"><Eye size={12} /> Aperçu</div><iframe title="aperçu" sandbox="" srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:12px;font-family:-apple-system,system-ui,sans-serif;font-size:15px;color:#1d1d1f;background:#fff}img{max-width:100%}img[width]{max-width:none}table{table-layout:auto}</style></head><body>${edit.html}</body></html>`} /></div>
              </div>
            </div>
          )}
          <div className="frow" style={{ justifyContent: 'flex-end' }}>
            <div style={{ flex: 1 }} />
            <button className="btn quiet" onClick={() => { setEdit(null); setTpl(false); setHistory([]) }}>Annuler</button>
            <button className="btn primary" onClick={async () => { await save(edit); setEdit(null); setTpl(false); setHistory([]) }}>Enregistrer</button>
          </div>
        </Group>
      ) : <button className="btn quiet" onClick={() => setEdit(blank())}><Plus size={14} /> Nouvelle signature</button>}
    </>
  )
}