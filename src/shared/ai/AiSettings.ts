// src/shared/ai/AiSettings.ts
import type { AiProviderKind } from './AiProvider'
import type { AiTask } from './AiTask'

export interface AiProviderConfig {
  kind: AiProviderKind
  model: string
  baseUrl?: string
  hasKey?: boolean
}

export interface AiSettings {
  enabled: boolean
  provider: AiProviderConfig
  redactBeforeCloud: boolean
  autoClassify: boolean
  autoReply: boolean
  allowSources: boolean
  verifyFacts: boolean
  detectEvents: boolean
  mailSearch: boolean
  mailSearchAccountIds: string[]   // vide = tous les comptes
  globalInstructions: string
  taskInstructions: Partial<Record<AiTask, string>>
  taskPrompts?: Partial<Record<AiTask | 'memory', string>>   // consignes de base remplacées (vide = défaut)
  replyLanguage: 'auto' | 'fr' | 'en'
  tone: 'neutre' | 'formel' | 'amical' | 'direct'
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: true,
  provider: { kind: 'ollama', model: 'llama3.1', baseUrl: 'http://127.0.0.1:11434' },
  redactBeforeCloud: true,
  autoClassify: false,
  autoReply: false,
  allowSources: true,
  verifyFacts: true,
  detectEvents: true,
  mailSearch: true,
  mailSearchAccountIds: [],
  globalInstructions: '',
  taskInstructions: {},
  replyLanguage: 'auto',
  tone: 'neutre'
}