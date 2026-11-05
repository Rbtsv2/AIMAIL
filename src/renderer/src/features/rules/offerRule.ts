// src/renderer/src/features/rules/offerRule.ts
// Après un déplacement manuel vers un dossier : proposer « toujours classer les mails de X ici ».
// Si une règle « Expéditeur → ce dossier » existe déjà pour le compte, l'adresse y est ajoutée ; sinon une règle est créée.
import { invoke } from '@/lib/api'
import { useUi } from '@/stores/ui.store'
import { useAccounts } from '@/stores/accounts.store'
import type { Rule } from '@shared/models/Rule'

const leafOf = (path: string, delimiter: string) => path.split(delimiter).pop() ?? path
// domaines de messagerie grand public : jamais de règle « tout le domaine »
const PUBLIC = /(^|\.)(gmail\.com|googlemail\.com|outlook\.(com|fr)|hotmail\.(com|fr)|live\.(com|fr)|msn\.com|yahoo\.(com|fr)|icloud\.com|me\.com|orange\.fr|wanadoo\.fr|free\.fr|sfr\.fr|laposte\.net|bbox\.fr|protonmail\.com|proton\.me|gmx\.(com|fr)|aol\.com)$/i
const domainOf = (a: string) => a.split('@')[1] ?? ''

/** À appeler AVANT le déplacement : expéditeurs des fils (hors mes propres adresses). */
export async function collectSenders(threadIds: string[]): Promise<Map<string, string>> {
  const mine = new Set(useAccounts.getState().accounts.map((a) => a.email.toLowerCase()))
  const senders = new Map<string, string>()
  for (const id of threadIds.slice(0, 20)) {
    try { const t = await invoke('threads:get', id); for (const m of t.messages) { const a = m.from.address.toLowerCase(); if (a && !mine.has(a)) senders.set(a, m.from.name || a) } } catch { /* fil déjà disparu */ }
  }
  return senders
}

export async function offerRuleAfterMove(senders: Map<string, string>, folderId: string): Promise<void> {
  try {
    const folder = Object.values(useAccounts.getState().folders).flat().find((f) => f.id === folderId)
    const dbg = (why: string) => console.info('[règle] pas de proposition :', why, { folderId, senders: [...senders.keys()] })
    if (!folder) return dbg('dossier inconnu')
    if (folder.role !== 'custom') return dbg('dossier système')
    if (!senders.size) return dbg('aucun expéditeur (ou seulement mes adresses)')
    if (senders.size > 3) return dbg('plus de 3 expéditeurs')
    const accountId = folder.accountId
    const rules = await invoke('rules:list')
    const existing = rules.find((r) => r.enabled && r.accountId === accountId && r.actions.some((a) => a.type === 'move' && a.folderId === folderId) && r.conditions.every((c) => c.field === 'from'))
    const already = existing ? existing.conditions.map((c) => c.value.toLowerCase()) : []
    const fresh = [...senders].filter(([a]) => !already.some((v) => a.includes(v)))
    if (!fresh.length) return dbg(`déjà couvert par « ${existing?.name} »`)
    console.info('[règle] proposition', { folder: folder.path, fresh: fresh.map(([a]) => a), existing: existing?.name })
    const who = fresh.map(([, n]) => n).join(', ')
    const name = leafOf(folder.path, folder.delimiter)
    useUi.getState().toast({
      text: `Toujours classer les mails de ${who} dans ${name} ?`, ttl: 12_000,
      action: { label: existing ? 'Oui, compléter la règle' : 'Oui, créer la règle', fn: async () => {
        // un seul expéditeur sur un domaine d'entreprise : proposer de couvrir tout le domaine (les notifications viennent souvent de plusieurs adresses)
        let values = fresh.map(([a]) => a)
        const dom = fresh.length === 1 ? domainOf(fresh[0][0]) : ''
        if (dom && !PUBLIC.test(dom) && !already.some((v) => v === `@${dom}`)) {
          const whole = await useUi.getState().confirm({ title: `Classer dans ${name}`, body: `Seulement ${fresh[0][0]}, ou tous les expéditeurs en @${dom} ?`, okLabel: `Tout @${dom}`, cancelLabel: 'Cette adresse seulement' })
          if (whole) values = [`@${dom}`]
        }
        const conds = values.map((v) => ({ field: 'from' as const, op: v.startsWith('@') ? 'endsWith' as const : 'contains' as const, value: v }))
        const rule: Rule = existing
          ? { ...existing, match: 'any', conditions: [...existing.conditions, ...conds] }
          : { id: '', name: `Mails de ${who}`, enabled: true, sortOrder: 999, accountId, match: 'any', conditions: conds, actions: [{ type: 'move', folderId }], stop: true, scope: 'inbox', createdAt: 0 }
        const saved = await invoke('rules:save', rule)
        const r = await invoke('rules:run', { ruleId: saved.id })
        useUi.getState().toast({ text: `${existing ? `Règle « ${saved.name} » complétée` : 'Règle créée'}${r.moved ? ` · ${r.moved} message(s) déplacé(s)` : ''}` })
      } }
    })
  } catch (e) { console.warn('[règle] proposition impossible', e) }
}