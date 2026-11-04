// src/main/attachments/extract.ts
import { readFileSync } from 'fs'
import { extname } from 'path'
import { convert } from 'html-to-text'

const MAX = 20000
export const EXTRACTABLE = /\.(pdf|docx|txt|md|csv|tsv|json|html?|xml|rtf|eml)$/i

export async function extractText(path: string, mimeType: string): Promise<string> {
  const ext = extname(path).toLowerCase()
  let t = ''
  if (ext === '.eml' || /message\/rfc822/.test(mimeType)) {
    // message joint (transfert Outlook « en pièce jointe ») : en-têtes + texte + pièces jointes textuelles imbriquées
    const { simpleParser } = await import('mailparser')
    const p = await simpleParser(readFileSync(path))
    const from = p.from?.text ?? '', to = (Array.isArray(p.to) ? p.to : p.to ? [p.to] : []).map((x) => x.text).join(', ')
    const body = p.text?.trim() ? p.text : typeof p.html === 'string' ? convert(p.html, { wordwrap: false, selectors: [{ selector: 'a', options: { ignoreHref: true } }, { selector: 'img', format: 'skip' }, { selector: 'style', format: 'skip' }] }) : ''
    let nested = ''
    for (const a of p.attachments ?? []) {
      if (!a.filename || a.size > 10_000_000) continue
      try {
        if (/pdf/.test(a.contentType)) { const pdf = (await import('pdf-parse')).default; nested += `\n\n[Pièce jointe ${a.filename}]\n${(await pdf(a.content, { max: 20 })).text}` }
        else if (/wordprocessingml/.test(a.contentType)) { const mammoth = await import('mammoth'); nested += `\n\n[Pièce jointe ${a.filename}]\n${(await mammoth.extractRawText({ buffer: a.content })).value}` }
        else if (/^text\//.test(a.contentType)) nested += `\n\n[Pièce jointe ${a.filename}]\n${a.content.toString('utf8')}`
      } catch {}
    }
    t = `De : ${from}\nÀ : ${to}\nDate : ${p.date?.toLocaleString('fr-FR') ?? ''}\nObjet : ${p.subject ?? ''}\n\n${body}${nested}`
  }
  else if (ext === '.pdf' || /pdf/.test(mimeType)) { const pdf = (await import('pdf-parse')).default; t = (await pdf(readFileSync(path), { max: 30 })).text }
  else if (ext === '.docx' || /wordprocessingml/.test(mimeType)) { const mammoth = await import('mammoth'); t = (await mammoth.extractRawText({ path })).value }
  else if (/\.html?$/.test(ext) || /html/.test(mimeType)) t = convert(readFileSync(path, 'utf8'), { wordwrap: false })
  else t = readFileSync(path, 'utf8')
  return t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX)
}