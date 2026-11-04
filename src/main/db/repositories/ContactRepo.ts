// src/main/db/repositories/ContactRepo.ts
import { getDb, j, p, id } from '../index'
import type { Contact, ContactInput } from '@shared/models/Contact'
import type { Address } from '@shared/models/Message'

function row(r: any): Contact {
  return {
    id: r.id, accountId: r.account_id, firstName: r.first_name, lastName: r.last_name, displayName: r.display_name,
    emails: p<string[]>(r.emails_json, []), phones: p<string[]>(r.phones_json, []), org: r.org, title: r.title, notes: r.notes,
    source: r.source, googleId: r.google_id, starred: !!r.starred, updatedAt: r.updated_at
  }
}

export const normalizeContact = (c: ContactInput): ContactInput => {
  const emails = [...new Set(c.emails.map((e) => e.trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))]
  const phones = [...new Set(c.phones.map((x) => x.trim()).filter(Boolean))]
  const first = c.firstName.trim(), last = c.lastName.trim()
  const display = c.displayName.trim() || `${first} ${last}`.trim() || c.org.trim() || emails[0] || ''
  return { ...c, firstName: first, lastName: last, displayName: display, emails, phones, org: c.org.trim(), title: c.title.trim(), notes: c.notes.trim() }
}

export const ContactRepo = {
  list(q = '', limit = 500): Contact[] {
    const db = getDb()
    if (!q.trim()) return db.prepare('SELECT * FROM contacts ORDER BY starred DESC, display_name COLLATE NOCASE LIMIT ?').all(limit).map(row)
    const like = `%${q.trim().toLowerCase()}%`
    return db.prepare(`SELECT * FROM contacts WHERE lower(display_name) LIKE ? OR lower(emails_json) LIKE ? OR lower(org) LIKE ? OR lower(first_name) LIKE ? OR lower(last_name) LIKE ? OR phones_json LIKE ?
      ORDER BY starred DESC, display_name COLLATE NOCASE LIMIT ?`).all(like, like, like, like, like, like, limit).map(row)
  },
  get(contactId: string): Contact | undefined {
    const r = getDb().prepare('SELECT * FROM contacts WHERE id = ?').get(contactId)
    return r ? row(r) : undefined
  },
  byEmail(email: string): Contact | undefined {
    const r = getDb().prepare("SELECT * FROM contacts WHERE lower(emails_json) LIKE ? LIMIT 1").get(`%"${email.toLowerCase()}"%`)
    return r ? row(r) : undefined
  },
  byGoogleId(accountId: string, googleId: string): Contact | undefined {
    const r = getDb().prepare('SELECT * FROM contacts WHERE account_id = ? AND google_id = ?').get(accountId, googleId)
    return r ? row(r) : undefined
  },
  save(input: ContactInput): Contact {
    const c = normalizeContact(input)
    const cid = c.id || id()
    getDb().prepare(`INSERT INTO contacts(id,account_id,first_name,last_name,display_name,emails_json,phones_json,org,title,notes,source,google_id,starred,updated_at)
      VALUES (@id,@account_id,@first,@last,@display,@emails,@phones,@org,@title,@notes,@source,@google,@starred,@updated)
      ON CONFLICT(id) DO UPDATE SET account_id=excluded.account_id, first_name=excluded.first_name, last_name=excluded.last_name, display_name=excluded.display_name,
        emails_json=excluded.emails_json, phones_json=excluded.phones_json, org=excluded.org, title=excluded.title, notes=excluded.notes, source=excluded.source,
        google_id=excluded.google_id, starred=excluded.starred, updated_at=excluded.updated_at`).run({
      id: cid, account_id: c.accountId, first: c.firstName, last: c.lastName, display: c.displayName, emails: j(c.emails), phones: j(c.phones),
      org: c.org, title: c.title, notes: c.notes, source: c.source, google: c.googleId, starred: c.starred ? 1 : 0, updated: Date.now()
    })
    return this.get(cid)!
  },
  // fusion par e-mail : complète un contact existant sans écraser ce qu'il a déjà
  merge(input: ContactInput): { contact: Contact; created: boolean } {
    const c = normalizeContact(input)
    const existing = c.emails.map((e) => this.byEmail(e)).find(Boolean)
    if (!existing) return { contact: this.save(c), created: true }
    const merged: ContactInput = {
      ...existing,
      firstName: existing.firstName || c.firstName, lastName: existing.lastName || c.lastName,
      displayName: existing.source === 'auto' && c.displayName ? c.displayName : existing.displayName || c.displayName,
      emails: [...new Set([...existing.emails, ...c.emails])], phones: [...new Set([...existing.phones, ...c.phones])],
      org: existing.org || c.org, title: existing.title || c.title, notes: existing.notes || c.notes,
      source: existing.source === 'auto' ? c.source : existing.source, googleId: existing.googleId ?? c.googleId
    }
    return { contact: this.save(merged), created: false }
  },
  remove(contactId: string): void { getDb().prepare('DELETE FROM contacts WHERE id = ?').run(contactId) },
  suggest(q: string, limit = 8): { name: string; address: string }[] {
    const out: { name: string; address: string }[] = []
    const sorted = this.list(q, 60).sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0) || (a.source === 'auto' ? 1 : 0) - (b.source === 'auto' ? 1 : 0) || (b.displayName && b.displayName !== b.emails[0] ? 1 : 0) - (a.displayName && a.displayName !== a.emails[0] ? 1 : 0))
    for (const c of sorted) for (const e of c.emails) { if (out.length < limit && (!q || e.includes(q.toLowerCase()) || c.displayName.toLowerCase().includes(q.toLowerCase()))) out.push({ name: c.displayName === e ? '' : c.displayName, address: e }) }
    return out
  },
  // ---- collecte automatique depuis les messages (comme « Adresses collectées » de Thunderbird)
  harvestAddresses(addresses: Address[], ownEmails: Set<string>): number {
    let added = 0
    const seen = new Set<string>()
    for (const a of addresses) {
      const email = (a.address ?? '').trim().toLowerCase()
      if (!email || seen.has(email) || ownEmails.has(email)) continue
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue
      if (/no[-_.]?reply|ne[-_.]?pas[-_.]?repondre|donotreply|mailer-daemon|notification|newsletter|bounce|postmaster|unsubscribe/i.test(email)) continue
      seen.add(email)
      const existing = this.byEmail(email)
      const name = (a.name ?? '').trim().replace(/^["']|["']$/g, '')
      if (existing) { if (!existing.displayName || existing.displayName === email) { if (name && name !== email) this.save({ ...existing, displayName: name }) } continue }
      if (/^[A-Z0-9._%+-]+@/i.test(email) && /^(undisclosed|recipients)/i.test(name)) continue
      this.save({ accountId: null, firstName: '', lastName: '', displayName: name && name !== email ? name : '', emails: [email], phones: [], org: '', title: '', notes: '', source: 'auto', googleId: null, starred: false })
      added++
    }
    return added
  },
  harvestAll(ownEmails: Set<string>): number {
    const rows = getDb().prepare('SELECT from_json, to_json, cc_json FROM messages').all() as any[]
    const all: Address[] = []
    for (const r of rows) {
      const f = p<Address>(r.from_json, { name: '', address: '' }); if (f.address) all.push(f)
      all.push(...p<Address[]>(r.to_json, []), ...p<Address[]>(r.cc_json, []))
    }
    return this.harvestAddresses(all, ownEmails)
  },
  count(): number { return (getDb().prepare('SELECT COUNT(*) c FROM contacts').get() as any).c }
}