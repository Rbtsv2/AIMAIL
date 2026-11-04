import { useSettings } from '@/stores/settings.store'

export function SignaturePicker({ accountId, value, onChange }: { accountId: string; value: string | null; onChange: (v: string | null) => void }) {
  const sigs = useSettings((s) => s.signatures).filter((s) => !s.accountId || s.accountId === accountId)
  if (!sigs.length) return null
  return (
    <select className="field" style={{ minWidth: 140, height: 30 }} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} aria-label="Signature">
      <option value="">Sans signature</option>
      {sigs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  )
}
