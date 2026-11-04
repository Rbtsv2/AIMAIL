export type AiTask = 'reply' | 'summarize' | 'rewrite' | 'classify' | 'translate' | 'chat'

export const AI_TASK_LABELS: Record<AiTask, string> = {
  reply: 'Répondre',
  summarize: 'Résumer',
  rewrite: 'Reformuler',
  classify: 'Classer',
  translate: 'Traduire',
  chat: 'Discuter'
}
