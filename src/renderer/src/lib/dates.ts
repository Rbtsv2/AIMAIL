const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()

export function relativeDate(ts: number): string {
  const d = new Date(ts), now = new Date()
  if (sameDay(d, now)) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (sameDay(d, y)) return 'Hier'
  if (now.getTime() - ts < 6 * 86400_000) return d.toLocaleDateString('fr-FR', { weekday: 'long' })
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const fullDate = (ts: number): string => new Date(ts).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
