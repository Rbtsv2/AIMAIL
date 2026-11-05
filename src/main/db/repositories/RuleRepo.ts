// src/main/db/repositories/RuleRepo.ts
import { getDb, id, j, p } from '../index'
import type { Rule } from '@shared/models/Rule'

const row = (r: any): Rule => ({ id: r.id, name: r.name, enabled: !!r.enabled, sortOrder: r.sort_order, accountId: r.account_id ?? null, match: r.match, conditions: p(r.conditions_json, []), actions: p(r.actions_json, []), stop: !!r.stop, createdAt: r.created_at })

export const RuleRepo = {
  list(): Rule[] { return getDb().prepare('SELECT * FROM rules ORDER BY sort_order, created_at').all().map(row) },
  get(ruleId: string): Rule | undefined { const r = getDb().prepare('SELECT * FROM rules WHERE id = ?').get(ruleId); return r ? row(r) : undefined },
  save(rule: Rule): Rule {
    const next = { ...rule, id: rule.id || id(), createdAt: rule.createdAt || Date.now() }
    getDb().prepare(`INSERT INTO rules(id, name, enabled, sort_order, account_id, match, conditions_json, actions_json, stop, created_at) VALUES (@id, @name, @enabled, @sort_order, @account_id, @match, @conditions, @actions, @stop, @created_at)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, enabled = excluded.enabled, sort_order = excluded.sort_order, account_id = excluded.account_id, match = excluded.match, conditions_json = excluded.conditions_json, actions_json = excluded.actions_json, stop = excluded.stop`)
      .run({ id: next.id, name: next.name, enabled: next.enabled ? 1 : 0, sort_order: next.sortOrder, account_id: next.accountId, match: next.match, conditions: j(next.conditions), actions: j(next.actions), stop: next.stop ? 1 : 0, created_at: next.createdAt })
    return next
  },
  delete(ruleId: string): void { getDb().prepare('DELETE FROM rules WHERE id = ?').run(ruleId) },
  reorder(ids: string[]): void { const st = getDb().prepare('UPDATE rules SET sort_order = ? WHERE id = ?'); ids.forEach((x, i) => st.run(i, x)) }
}