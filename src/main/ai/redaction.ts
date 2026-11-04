const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g
const PHONE = /(\+33|0)[1-9](?:[\s.-]?\d{2}){4}/g
const IBAN = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}\b/g

export function redact(text: string): { text: string; restore: (s: string) => string } {
  const map = new Map<string, string>()
  let n = 0
  const sub = (re: RegExp, tag: string) => (s: string) => s.replace(re, (m) => {
    const key = `[${tag}_${++n}]`; map.set(key, m); return key
  })
  let out = text
  out = sub(EMAIL, 'EMAIL')(out)
  out = sub(PHONE, 'TEL')(out)
  out = sub(IBAN, 'IBAN')(out)
  return { text: out, restore: (s) => { let r = s; for (const [k, v] of map) r = r.split(k).join(v); return r } }
}
