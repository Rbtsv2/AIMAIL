// src/main/ai/Classifier.ts
import { SettingsRepo } from '../db/repositories/SettingsRepo'
import { AccountRepo } from '../db/repositories/AccountRepo'
import { MessageRepo } from '../db/repositories/MessageRepo'
import { ThreadRepo } from '../db/repositories/ThreadRepo'
import { SyncManager } from '../sync/SyncManager'
import { events } from '../sync/events'
import { createProvider } from './providers'
import { buildMessages } from './PromptBuilder'
import { log } from '../utils/logger'

export const CATEGORIES = ['urgent', 'action', 'information', 'newsletter', 'spam'] as const
export type Category = (typeof CATEGORIES)[number]

const queue: string[] = []
let running = false

function normalize(text: string): Category | null {
  const t = text.toLowerCase()
  for (const c of CATEGORIES) if (t.includes(c)) return c
  if (/info/.test(t)) return 'information'
  if (/urgen/.test(t)) return 'urgent'
  return null
}

async function work(): Promise<void> {
  if (running) return
  running = true
  try {
    while (queue.length) {
      const id = queue.shift()!
      const settings = SettingsRepo.ai()
      if (!settings.enabled || !settings.autoClassify) { queue.length = 0; break }
      const m = MessageRepo.get(id)
      if (!m || m.category) continue
      const account = AccountRepo.get(m.accountId)
      if (!account) continue
      try {
        if (!m.bodyFetched) { const b = await SyncManager.engine(m.accountId).fetchBody(m); m.bodyHtml = b.html; m.bodyText = b.text; m.bodyFetched = true }
        const provider = createProvider(settings.provider)
        const msgs = buildMessages({ task: 'classify', accountId: m.accountId, messageId: m.id }, settings, account, [m])
        const out = await provider.complete({ model: settings.provider.model, messages: msgs, temperature: 0, maxTokens: 10 })
        const cat = normalize(out)
        if (cat) {
          MessageRepo.setCategory(m.id, cat)
          ThreadRepo.recompute(m.threadId)
          events.emitEvent('mail:changed', { accountId: m.accountId, threadIds: [m.threadId] })
        }
      } catch (e: any) {
        log.warn('classify', m.subject, e?.message ?? e)
        if (/ECONNREFUSED|fetch failed|401|403/.test(String(e?.message))) { queue.length = 0; break }
      }
    }
  } finally { running = false }
}

export const Classifier = {
  enqueue(messageId: string): void {
    const s = SettingsRepo.ai()
    if (!s.enabled || !s.autoClassify) return
    if (!queue.includes(messageId)) queue.push(messageId)
    void work()
  },
  enqueueMany(ids: string[]): void { for (const id of ids) this.enqueue(id) }
}