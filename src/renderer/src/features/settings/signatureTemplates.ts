// src/renderer/src/features/settings/signatureTemplates.ts
// Modèles de signature compatibles e-mail : tableaux + styles en ligne, aucune police externe.
export interface SigVars { name: string; role: string; company: string; email: string; phone: string; site: string; address: string; accent: string; logo: string }

const AVATAR = (v: SigVars, size: number) => v.logo
  ? `<img src="${v.logo}" width="${size}" height="${size}" alt="" style="width:${size}px;height:${size}px;border-radius:50%;display:block;object-fit:cover">`
  : `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${v.accent};color:#fff;font-weight:700;font-size:${Math.round(size / 2.6)}px;line-height:${size}px;text-align:center">${v.name.split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()}</div>`

export const TEMPLATES: { id: string; name: string; description: string; build: (v: SigVars) => string }[] = [
  {
    id: 'card', name: 'Carte', description: 'Photo ronde à gauche, barre d’accent, contacts alignés.',
    build: (v) => `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#374151;line-height:1.5"><tr>
<td style="padding:0 16px 0 0;vertical-align:top">${AVATAR(v, 72)}</td>
<td style="border-left:3px solid ${v.accent};padding:2px 0 2px 16px;vertical-align:top">
<div style="font-size:16px;font-weight:700;color:#111827">${v.name}</div>
<div style="color:${v.accent};font-weight:600;font-size:12px;letter-spacing:.04em;text-transform:uppercase">${v.role}</div>
<div style="color:#6b7280;margin-bottom:8px">${v.company}</div>
<div><a href="mailto:${v.email}" style="color:#374151;text-decoration:none">✉&nbsp; ${v.email}</a></div>
<div><a href="tel:${v.phone.replace(/\s/g, '')}" style="color:#374151;text-decoration:none">☎&nbsp; ${v.phone}</a></div>
<div><a href="${v.site}" style="color:${v.accent};text-decoration:none">🌐&nbsp; ${v.site.replace(/^https?:\/\//, '')}</a></div>
</td></tr></table>`
  },
  {
    id: 'minimal', name: 'Minimal', description: 'Une ligne de nom, un filet, coordonnées discrètes.',
    build: (v) => `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Georgia,'Times New Roman',serif;color:#1f2937;font-size:14px"><tr><td style="padding-bottom:6px;border-bottom:1px solid ${v.accent}">
<span style="font-size:17px;font-weight:700">${v.name}</span>&nbsp;&nbsp;<span style="color:#6b7280;font-style:italic">${v.role}, ${v.company}</span>
</td></tr><tr><td style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7280;letter-spacing:.02em">
<a href="mailto:${v.email}" style="color:#6b7280;text-decoration:none">${v.email}</a> &nbsp;·&nbsp; ${v.phone} &nbsp;·&nbsp; <a href="${v.site}" style="color:${v.accent};text-decoration:none">${v.site.replace(/^https?:\/\//, '')}</a><br>
<span style="color:#9ca3af">${v.address}</span>
</td></tr></table>`
  },
  {
    id: 'band', name: 'Bandeau', description: 'En-tête coloré au nom de la société, bloc contact, mention légale.',
    build: (v) => `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#374151;max-width:520px;border-radius:8px;overflow:hidden"><tr>
<td style="background:${v.accent};color:#fff;padding:10px 16px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">${v.company}</td></tr>
<tr><td style="padding:14px 16px;background:#f9fafb"><table cellpadding="0" cellspacing="0" border="0"><tr>
<td style="padding-right:14px;vertical-align:middle">${AVATAR(v, 56)}</td>
<td style="vertical-align:middle"><div style="font-size:16px;font-weight:700;color:#111827">${v.name}</div><div style="color:#6b7280">${v.role}</div></td></tr></table>
<div style="margin-top:12px;line-height:1.7"><a href="mailto:${v.email}" style="color:#374151;text-decoration:none">${v.email}</a><br><a href="tel:${v.phone.replace(/\s/g, '')}" style="color:#374151;text-decoration:none">${v.phone}</a><br><a href="${v.site}" style="color:${v.accent};text-decoration:none;font-weight:600">${v.site.replace(/^https?:\/\//, '')}</a></div>
</td></tr><tr><td style="padding:8px 16px;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb">${v.address} — Ce message et ses pièces jointes sont confidentiels.</td></tr></table>`
  }
]