import { useState } from 'react'
import { Send } from 'lucide-react'
import type { Message } from '@shared/models/Message'
import { useCompose } from '@/stores/compose.store'

export function QuickReply({ last, threadId }: { last: Message; threadId: string }) {
  const [text, setText] = useState('')
  const send = async () => {
    if (!text.trim()) return
    const c = useCompose.getState()
    c.openReply(last, 'reply', threadId)
    const d = useCompose.getState().draft!
    c.update({ html: `<p>${text.replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>${d.html}` })
    await useCompose.getState().send()
    setText('')
  }
  return (
    <div style={{ margin: '0 24px 24px', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      <textarea className="field" style={{ flex: 1, minHeight: 44, minWidth: 0 }} placeholder={`Répondre à ${last.from.name || last.from.address}`} value={text} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void send() }} />
      <button className="btn primary" disabled={!text.trim()} onClick={() => void send()}><Send size={14} /> Envoyer</button>
    </div>
  )
}
