// src/main/contacts/exporters.ts
import type { Contact } from '@shared/models/Contact'

const q = (v: string) => `"${v.replace(/"/g, '""')}"`

export function exportCsv(cs: Contact[], delim = ','): string {
  const head = ['Prénom', 'Nom', 'Nom affiché', 'E-mail', 'E-mail 2', 'Téléphone', 'Téléphone 2', 'Organisation', 'Fonction', 'Notes']
  const lines = cs.map((c) => [c.firstName, c.lastName, c.displayName, c.emails[0] ?? '', c.emails[1] ?? '', c.phones[0] ?? '', c.phones[1] ?? '', c.org, c.title, c.notes].map(q).join(delim))
  return '\uFEFF' + [head.map(q).join(delim), ...lines].join('\r\n')
}

const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')

export function exportVcard(cs: Contact[]): string {
  return cs.map((c) => [
    'BEGIN:VCARD', 'VERSION:3.0',
    `FN:${esc(c.displayName)}`, `N:${esc(c.lastName)};${esc(c.firstName)};;;`,
    ...c.emails.map((e, i) => `EMAIL;TYPE=INTERNET${i === 0 ? ',PREF' : ''}:${e}`),
    ...c.phones.map((p) => `TEL;TYPE=VOICE:${p}`),
    ...(c.org ? [`ORG:${esc(c.org)}`] : []), ...(c.title ? [`TITLE:${esc(c.title)}`] : []), ...(c.notes ? [`NOTE:${esc(c.notes)}`] : []),
    'END:VCARD'
  ].join('\r\n')).join('\r\n') + '\r\n'
}