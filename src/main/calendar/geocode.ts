// src/main/calendar/geocode.ts
export interface Place { label: string; city: string; postcode: string; country: string }

let lastNominatim = 0

export async function suggestPlaces(q: string): Promise<Place[]> {
  const query = q.trim()
  if (query.length < 3) return []
  const out: Place[] = []
  try {
    const r = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=6&autocomplete=1`, { signal: AbortSignal.timeout(4000) })
    if (r.ok) {
      const j = (await r.json()) as any
      for (const f of j.features ?? []) {
        const p = f.properties ?? {}
        out.push({ label: p.label ?? '', city: p.city ?? '', postcode: p.postcode ?? '', country: 'France' })
      }
    }
  } catch {}
  if (out.length < 3) {
    // Nominatim : 1 requête/seconde maximum, User-Agent obligatoire
    const wait = 1100 - (Date.now() - lastNominatim)
    if (wait > 0) await new Promise((res) => setTimeout(res, wait))
    lastNominatim = Date.now()
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&addressdetails=1&limit=5&accept-language=fr`, { headers: { 'User-Agent': 'AIMAIL/0.1 (contact@chilloutnetworks.com)' }, signal: AbortSignal.timeout(5000) })
      if (r.ok) {
        for (const n of (await r.json()) as any[]) {
          const a = n.address ?? {}
          const label = n.display_name ?? ''
          if (out.some((x) => x.label === label)) continue
          out.push({ label, city: a.city ?? a.town ?? a.village ?? a.municipality ?? '', postcode: a.postcode ?? '', country: a.country ?? '' })
        }
      }
    } catch {}
  }
  return out.slice(0, 8)
}