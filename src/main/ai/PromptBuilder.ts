// src/main/ai/PromptBuilder.ts
import type { AiSettings } from '@shared/ai/AiSettings'
import type { AiMessage } from '@shared/ai/AiProvider'
import type { AiRunInput } from '@shared/ipc'
import type { Account } from '@shared/models/Account'
import type { Message } from '@shared/models/Message'
import { convert } from 'html-to-text'
import { AI_MAX_CONTEXT_MESSAGES } from '@shared/constants'

import { DEFAULT_TASK_PROMPTS } from '@shared/ai/prompts'
import type { AiTask } from '@shared/ai/AiTask'
const TASK_SYSTEM: Record<string, string> = DEFAULT_TASK_PROMPTS

const TONE: Record<AiSettings['tone'], string> = {
  neutre: 'Ton neutre et professionnel.',
  formel: 'Ton formel, vouvoiement, formules de politesse complètes.',
  amical: 'Ton chaleureux et direct, tutoiement si le fil l’utilise.',
  direct: 'Ton direct, phrases courtes, pas de formules superflues.'
}

const asText = (m: Message): string => (m.bodyText ?? (m.bodyHtml ? convert(m.bodyHtml, { wordwrap: false }) : m.snippet)).trim().slice(0, 6000)

export const messageToContext = (m: Message, account: Account): string => {
  const mine = m.from.address.toLowerCase() === account.email.toLowerCase()
  const atts = (m.attachments ?? []).filter((a) => !a.inline)
  const attText = atts.filter((a) => a.text).slice(0, 3).map((a) => `\n\n[Pièce jointe « ${a.filename} »]\n${(a.text ?? '').slice(0, 3500)}`).join('')
  const attNames = atts.filter((a) => !a.text).map((a) => a.filename)
  return `--- ${mine ? 'ENVOYÉ PAR L’UTILISATEUR' : 'REÇU PAR L’UTILISATEUR'} · De : ${m.from.name || m.from.address} <${m.from.address}> · À : ${(m.to ?? []).map((a) => a.address).join(', ')} · ${new Date(m.date).toLocaleString('fr-FR')}\nObjet : ${m.subject}${attNames.length ? `\nPièces jointes (non lisibles) : ${attNames.join(', ')}` : ''}\n\n${asText(m)}${attText}`
}

export function buildMessages(input: AiRunInput, settings: AiSettings, account: Account, thread: Message[], priorSummary?: string): AiMessage[] {
  // consigne de base : celle des réglages si l'utilisateur l'a modifiée, sinon celle par défaut
  const base = (settings.taskPrompts?.[input.task as AiTask | 'memory'] ?? '').trim() || DEFAULT_TASK_PROMPTS[input.task as AiTask] || TASK_SYSTEM[input.task] || TASK_SYSTEM.chat
  const sys: string[] = [base, TONE[settings.tone]]
  if (settings.replyLanguage !== 'auto') sys.push(`Réponds en ${settings.replyLanguage === 'fr' ? 'français' : 'anglais'}.`)
  else sys.push('Réponds dans la langue du dernier message du fil.')
  sys.push(`Tu écris AU NOM DE l’utilisateur : ${account.name} <${account.email}>. Tu n’es jamais l’expéditeur des messages reçus.`)
  const last = thread[thread.length - 1]
  if (last && input.task === 'reply') {
    const mine = last.from.address.toLowerCase() === account.email.toLowerCase()
    if (!mine) sys.push(`Le dernier message a été envoyé par ${last.from.name || last.from.address} <${last.from.address}>. Ta réponse s’adresse à cette personne : salue-la par son prénom si tu le connais, sinon « Bonjour, ». Ne reformule pas son message, ne te présente pas comme elle.`)
    else sys.push('Le dernier message du fil a été envoyé par l’utilisateur lui-même : rédige une relance courte adressée au destinataire précédent.')
  }
  if (settings.globalInstructions.trim()) sys.push(`Instructions générales de l’utilisateur :\n${settings.globalInstructions.trim()}`)
  if (account.aiInstructions.trim()) sys.push(`Instructions pour ce compte :\n${account.aiInstructions.trim()}`)
  const taskIns = settings.taskInstructions[input.task]
  if (taskIns?.trim()) sys.push(`Instructions pour cette tâche :\n${taskIns.trim()}`)

  const recent = thread.slice(-AI_MAX_CONTEXT_MESSAGES)
  const ctx = (priorSummary ? `=== Résumé des ${thread.length - recent.length} messages précédents du fil ===\n${priorSummary}\n\n=== Messages récents ===\n` : '') + recent.map((m) => messageToContext(m, account)).join('\n\n')

  const user: string[] = []
  if (ctx) user.push(`Fil de discussion :\n\n${ctx}`)
  if (input.selection) user.push(`Texte sélectionné :\n${input.selection}`)
  if (input.draftHtml) user.push(`Brouillon actuel :\n${convert(input.draftHtml, { wordwrap: false })}`)
  if (input.userPrompt) user.push(`Consigne : ${input.userPrompt}`)
  if (input.global) user.unshift('Question posée sur l’ensemble de la boîte mail : utilise l’outil de recherche dans les e-mails pour trouver les messages pertinents avant de répondre, en tenant compte des échanges précédents uniquement si la question y fait référence (sinon traite-la comme indépendante). Réponds de façon structurée et cite les messages (expéditeur, date, objet).')
  if (!user.length) user.push('Procède.')

  const prior: AiMessage[] = (input.history ?? []).slice(input.global ? -2 : -8).map((h) => ({ role: h.role, content: h.content.slice(0, input.global ? 600 : 1500) }))
  return [{ role: 'system', content: sys.join('\n\n') }, ...prior, { role: 'user', content: user.join('\n\n') }]
}