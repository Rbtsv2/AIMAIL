// src/main/contacts/GoogleContacts.ts
import type { Account } from '@shared/models/Account'
import type { ContactInput } from '@shared/models/Contact'
import { resolveGoogleData as resolveAuth } from '../auth'
import { ContactRepo } from '../db/repositories/ContactRepo'

// Nécessite le scope https://www.googleapis.com/auth/contacts.readonly à l'ajout du compte Gmail.
export async function syncGoogleContacts(account: Account): Promise<{ imported: number; updated: number }> {
  if (account.auth !== 'oauth-google') throw new Error('ce compte n’est pas un compte Google')
  const auth = await resolveAuth(account)
  let imported = 0, updated = 0, pageToken = ''
  do {
    const url = new URL('https://people.googleapis.com/v1/people/me/connections')
    url.searchParams.set('personFields', 'names,emailAddresses,phoneNumbers,organizations,biographies')
    url.searchParams.set('pageSize', '1000')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const res = await fetch(url, { headers: { Authorization: `Bearer ${auth.accessToken}` } })
    if (res.status === 403) throw new Error('accès aux contacts non autorisé : retirez et rajoutez le compte Gmail pour accorder la permission « Contacts »')
    if (!res.ok) throw new Error(`Google People ${res.status}`)
    const j = (await res.json()) as any
    for (const p of j.connections ?? []) {
      const name = p.names?.[0]
      const c: ContactInput = {
        accountId: account.id, firstName: name?.givenName ?? '', lastName: name?.familyName ?? '', displayName: name?.displayName ?? '',
        emails: (p.emailAddresses ?? []).map((e: any) => e.value), phones: (p.phoneNumbers ?? []).map((e: any) => e.value),
        org: p.organizations?.[0]?.name ?? '', title: p.organizations?.[0]?.title ?? '', notes: p.biographies?.[0]?.value ?? '',
        source: 'google', googleId: p.resourceName, starred: false
      }
      if (!c.emails.length && !c.displayName) continue
      const existing = ContactRepo.byGoogleId(account.id, p.resourceName)
      if (existing) { ContactRepo.save({ ...c, id: existing.id, starred: existing.starred }); updated++ }
      else { const r = ContactRepo.merge(c); if (r.created) imported++; else updated++ }
    }
    pageToken = j.nextPageToken ?? ''
  } while (pageToken)
  return { imported, updated }
}