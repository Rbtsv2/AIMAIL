import type { Address } from '@shared/models/Message'
import { initials, colorFor } from '@/lib/text'

export function Avatar({ who, size = 36 }: { who: Address; size?: number }) {
  return <div className="avatar" style={{ background: colorFor(who.address.toLowerCase()), width: size, height: size, fontSize: size * 0.36 }}>{initials(who)}</div>
}
