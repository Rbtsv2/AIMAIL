// src/main/smtp/MimeBuilder.ts
import type { Draft } from '@shared/models/Draft'
import type { Account } from '@shared/models/Account'
import type { Signature } from '@shared/models/Signature'
import type Mail from 'nodemailer/lib/mailer'
import { basename } from 'path'
import { convert } from 'html-to-text'
import { cleanSignatureHtml } from '@shared/signature'

const fmt = (a: { name: string; address: string }) => (a.name ? `"${a.name.replace(/"/g, '')}" <${a.address}>` : a.address)

function inlineImages(html: string): { html: string; attachments: Mail.Attachment[] } {
  const attachments: Mail.Attachment[] = []
  let n = 0
  const out = html.replace(/src="data:(image\/[a-z+]+);base64,([^"]+)"/gi, (_m, mime: string, b64: string) => {
    const cid = `img${++n}@mail.local`
    attachments.push({ filename: `image${n}.${mime.split('/')[1].replace('jpeg', 'jpg')}`, content: Buffer.from(b64, 'base64'), contentType: mime, cid, contentDisposition: 'inline' })
    return `src="cid:${cid}"`
  })
  return { html: out, attachments }
}

export function buildMailOptions(draft: Draft, account: Account, signature: Signature | undefined, inReplyTo?: { messageId: string; references: string[] }): Mail.Options {
  const sigHtml = signature ? `<div class="signature" style="margin-top:16px">${cleanSignatureHtml(signature.html)}</div>` : ''
  const sigText = signature ? `\n\n-- \n${signature.text}` : ''
  // la signature se place sous le texte, avant le message cité
  const qi = draft.html.indexOf('<div style="color:#6e6e73')
  const bodyHtml = qi >= 0 ? draft.html.slice(0, qi) + sigHtml + draft.html.slice(qi) : draft.html + sigHtml
  const inl = inlineImages(bodyHtml)
  const html = `<div style="font-family:-apple-system,system-ui,Segoe UI,sans-serif;font-size:15px;line-height:1.5">${inl.html}</div>`
  const qt = qi >= 0 ? convert(draft.html.slice(0, qi), { wordwrap: 78 }) : (draft.text || convert(draft.html, { wordwrap: 78 }))
  const text = qi >= 0 ? qt + sigText + '\n\n' + convert(draft.html.slice(qi), { wordwrap: 78 }) : qt + sigText
  return {
    from: fmt({ name: account.name, address: account.email }),
    to: draft.to.map(fmt), cc: draft.cc.map(fmt), bcc: draft.bcc.map(fmt),
    subject: draft.subject,
    text, html,
    inReplyTo: inReplyTo?.messageId,
    references: inReplyTo ? [...inReplyTo.references, inReplyTo.messageId].join(' ') : undefined,
    attachments: [...draft.attachmentPaths.map((p) => ({ path: p, filename: basename(p) })), ...inl.attachments]
  }
}