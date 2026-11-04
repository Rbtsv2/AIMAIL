// src/renderer/src/features/ai/useAi.ts
import { useAi } from '@/stores/ai.store'
import { useMail } from '@/stores/mail.store'
import type { AiTask } from '@shared/ai/AiTask'

export function useAiOnThread() {
  const cur = useMail((s) => s.current)
  const run = useAi((s) => s.run)
  const trigger = (task: AiTask, userPrompt?: string, auto = false) => {
    if (!cur) return
    void run({ task, accountId: cur.thread.accountId, threadId: cur.thread.id, userPrompt, auto })
  }
  return { trigger, available: !!cur }
}