import { hasGoogleData } from '../../auth'
// src/main/db/repositories/AccountRepo.ts
import { setOwnAddresses } from './ThreadRepo'
import { getDb, j, p, id } from '../index'
import type { Account, AccountInput } from '@shared/models/Account'

const COLORS = ['#4F6BED', '#2EAF8A', '#E0745A', '#8E5BD8', '#D6A42C', '#3C9BD9']

function row(r: any): Account {
  return {
    id: r.id, email: r.email, name: r.name, provider: r.provider, auth: r.auth,
    googleData: r.auth === 'oauth-google' || hasGoogleData({ id: r.id, auth: r.auth } as Account),
    imap: p(r.imap_json, { host: '', port: 993, secure: true }),
    smtp: p(r.smtp_json, { host: '', port: 465, secure: true }),
    color: r.color, defaultSignatureId: r.default_signature_id,
    aiInstructions: r.ai_instructions, purgeSpamDays: r.purge_spam_days ?? null, purgeTrashDays: r.purge_trash_days ?? null, createdAt: r.created_at
  }
}

export const AccountRepo = {
  list(): Account[] {
    const out = this._list()
    setOwnAddresses(out.map((a) => a.email))
    return out
  },
  _list(): Account[] {
    return getDb().prepare('SELECT * FROM accounts ORDER BY COALESCE(sort_order, 1000000), created_at').all().map(row)
  },
  get(accountId: string): Account | undefined {
    const r = getDb().prepare('SELECT * FROM accounts WHERE id = ?').get(accountId)
    return r ? row(r) : undefined
  },
  create(input: AccountInput): Account {
    const db = getDb()
    const count = db.prepare('SELECT COUNT(*) c FROM accounts').get() as any
    const acc: Account = {
      id: id(), email: input.email, name: input.name, provider: input.provider, auth: input.auth,
      imap: input.imap, smtp: input.smtp, color: COLORS[count.c % COLORS.length],
      defaultSignatureId: null, aiInstructions: '', purgeSpamDays: null, purgeTrashDays: null, createdAt: Date.now()
    }
    db.prepare(`INSERT INTO accounts(id,email,name,provider,auth,imap_json,smtp_json,color,default_signature_id,ai_instructions,created_at)
      VALUES (@id,@email,@name,@provider,@auth,@imap,@smtp,@color,@sig,@ai,@created)`).run({
      id: acc.id, email: acc.email, name: acc.name, provider: acc.provider, auth: acc.auth,
      imap: j(acc.imap), smtp: j(acc.smtp), color: acc.color, sig: null, ai: '', created: acc.createdAt
    })
    return acc
  },
  update(accountId: string, patch: Partial<Account>): Account {
    const cur = this.get(accountId)
    if (!cur) throw new Error('account not found')
    const next = { ...cur, ...patch, id: accountId }
    getDb().prepare(`UPDATE accounts SET name=@name, imap_json=@imap, smtp_json=@smtp, color=@color,
      default_signature_id=@sig, ai_instructions=@ai, purge_spam_days=@ps, purge_trash_days=@pt WHERE id=@id`).run({
      id: accountId, name: next.name, imap: j(next.imap), smtp: j(next.smtp), color: next.color,
      sig: next.defaultSignatureId, ai: next.aiInstructions, ps: next.purgeSpamDays ?? null, pt: next.purgeTrashDays ?? null
    })
    return next
  },
  reorder(orderedIds: string[]): void {
    const stmt = getDb().prepare('UPDATE accounts SET sort_order = ? WHERE id = ?')
    orderedIds.forEach((id, i) => stmt.run(i, id))
  },
  remove(accountId: string): void {
    getDb().prepare('DELETE FROM accounts WHERE id = ?').run(accountId)
  }
}