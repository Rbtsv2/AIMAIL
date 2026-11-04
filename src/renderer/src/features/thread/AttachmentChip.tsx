import { FileText, Image, File, Download } from 'lucide-react'
import type { Attachment } from '@shared/models/Attachment'
import { formatSize } from '@/lib/text'
import { invoke } from '@/lib/api'

export function AttachmentChip({ a }: { a: Attachment }) {
  const Icon = a.mimeType.startsWith('image/') ? Image : a.mimeType === 'application/pdf' ? FileText : File
  return (
    <div className="att" onDoubleClick={() => void invoke('attachments:open', a.id)} title={a.filename}>
      <Icon size={15} />
      <span className="n">{a.filename}</span>
      <span className="s">{formatSize(a.size)}</span>
      <button className="icon-btn" style={{ width: 22, height: 22 }} aria-label="Enregistrer" onClick={() => void invoke('attachments:save', a.id)}><Download size={13} /></button>
    </div>
  )
}
