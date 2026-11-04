// src/shared/signature.ts
// Nettoie une signature HTML venue d'ailleurs (Thunderbird, Outlook, copier-coller) :
// séquences \n littérales, document complet réduit au corps, styles de <head> inlinés grossièrement.
export function cleanSignatureHtml(input: string): string {
  let h = input
  // séquences échappées littérales (\n, \t, \") : toujours décodées
  h = h.replace(/\\r/g, '').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"')
  const body = h.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (body) h = body[1]
  h = h.replace(/<!DOCTYPE[^>]*>/gi, '').replace(/<\/?(html|head|meta|title)[^>]*>/gi, '')
  h = h.replace(/<style[\s\S]*?<\/style>/gi, '')
  h = h.replace(/<script[\s\S]*?<\/script>/gi, '')
  h = h.replace(/\n\s*\n/g, '\n').trim()
  return h
}

export const signatureText = (html: string): string =>
  html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim()