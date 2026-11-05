// src/shared/models/Rule.ts
export type RuleField = 'from' | 'to' | 'subject' | 'body' | 'attachment' | 'category' | 'account'
export type RuleOp = 'contains' | 'notContains' | 'equals' | 'startsWith' | 'endsWith' | 'is' | 'isNot'
export interface RuleCondition { field: RuleField; op: RuleOp; value: string }
export type RuleAction =
  | { type: 'move'; folderId: string }
  | { type: 'markRead' }
  | { type: 'star' }
  | { type: 'spam' }
  | { type: 'trash' }
  | { type: 'inbox' }          // remettre en Réception (rattrapage depuis Indésirables)
  | { type: 'category'; value: 'urgent' | 'action' | 'info' | 'newsletter' }
export interface Rule {
  id: string
  name: string
  enabled: boolean
  sortOrder: number
  accountId: string | null
  match: 'all' | 'any'
  conditions: RuleCondition[]
  actions: RuleAction[]
  stop: boolean
  scope: 'inbox' | 'spam' | 'both'   // dossiers où la règle s'applique
  createdAt: number
}