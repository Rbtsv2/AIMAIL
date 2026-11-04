import { Mail } from 'lucide-react'
import type { ProviderPreset } from '@shared/models/Account'

const ITEMS: { id: ProviderPreset; label: string }[] = [
  { id: 'gmail', label: 'Gmail' }, { id: 'outlook', label: 'Outlook / Microsoft 365' }, { id: 'icloud', label: 'iCloud' }, { id: 'ovh', label: 'OVH' }, { id: 'custom', label: 'Autre (IMAP)' }
]
export function ProviderPicker({ onPick }: { onPick: (p: ProviderPreset) => void }) {
  return (
    <div className="provider-grid">
      {ITEMS.map((i) => <button key={i.id} onClick={() => onPick(i.id)}><Mail size={16} /> {i.label}</button>)}
    </div>
  )
}
