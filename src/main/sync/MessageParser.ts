// src/main/sync/MessageParser.ts
import { simpleParser, type ParsedMail, type AddressObject } from 'mailparser'
import { convert } from 'html-to-text'
import type { Address } from '@shared/models/Message'

export interface ParsedBody {
  html: string | null
  text: string | null
  attachments: { filename: string; mimeType: string; size: number; contentId: string | null; inline: boolean; content: Buffer }[]
}

export const toAddresses = (a?: AddressObject | AddressObject[]): Address[] => {
  const list = Array.isArray(a) ? a : a ? [a] : []
  return list.flatMap((x) => x.value.map((v) => ({ name: v.name ?? '', address: v.address ?? '' })))
}

export const snippetOf = (html: string | null, text: string | null, len = 140): string => {
  const t = text ?? (html ? convert(html, { wordwrap: false, selectors: [{ selector: 'a', options: { ignoreHref: true } }, { selector: 'img', format: 'skip' }] }) : '')
  return t.replace(/\s+/g, ' ').trim().slice(0, len)
}

export async function parseRaw(raw: Buffer): Promise<ParsedBody & { parsed: ParsedMail }> {
  const parsed = await simpleParser(raw, { skipImageLinks: true })
  const html = typeof parsed.html === 'string' ? parsed.html : null
  // mails HTML seuls (Outlook, transferts) : texte dérivé du HTML pour la recherche et l'assistant
  const text = parsed.text?.trim() ? parsed.text : html ? convert(html, { wordwrap: false, selectors: [{ selector: 'a', options: { ignoreHref: true } }, { selector: 'img', format: 'skip' }, { selector: 'style', format: 'skip' }] }) : null
  return {
    parsed,
    html,
    text,
    attachments: parsed.attachments.map((a) => ({
      filename: a.filename ?? 'piece-jointe',
      mimeType: a.contentType,
      size: a.size,
      contentId: a.cid ?? null,
      inline: !!a.cid && a.contentDisposition !== 'attachment',
      content: a.content
    }))
  }
}