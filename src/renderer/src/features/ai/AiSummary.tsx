import { useEffect } from 'react'
import { useAi } from '@/stores/ai.store'

export function AiSummary({ accountId, threadId }: { accountId: string; threadId: string }) {
  const run = useAi((s) => s.run)
  const output = useAi((s) => s.output)
  const task = useAi((s) => s.task)
  useEffect(() => { void run({ task: 'summarize', accountId, threadId }) }, [threadId])
  if (task !== 'summarize') return null
  return <div className="msg" style={{ padding: 16, whiteSpace: 'pre-wrap' }}>{output}</div>
}
