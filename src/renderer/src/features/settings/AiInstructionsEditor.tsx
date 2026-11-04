import { useAi } from '@/stores/ai.store'
import { AI_TASK_LABELS, type AiTask } from '@shared/ai/AiTask'
import { Group, Row, TextArea } from '@/design-system/Field'

const TASKS: AiTask[] = ['reply', 'summarize', 'rewrite', 'translate', 'classify']

export function AiInstructionsEditor() {
  const settings = useAi((s) => s.settings)
  const save = useAi((s) => s.save)
  if (!settings) return null
  return (
    <>
      <Group>
        <Row column label="Instructions générales" hint="Appliquées à chaque demande, quel que soit le compte ou la tâche. Qui vous êtes, votre style, ce qu’il faut toujours ou jamais faire.">
          <TextArea defaultValue={settings.globalInstructions} placeholder={'Ex. :\n- Phrases courtes, pas de jargon.\n- Ne jamais promettre de délai sans que je l’aie écrit.\n- Les mails en anglais restent en anglais.'} onBlur={(e) => e.target.value !== settings.globalInstructions && void save({ globalInstructions: e.target.value })} style={{ minHeight: 130 }} />
        </Row>
      </Group>
      <Group>
        {TASKS.map((t) => (
          <Row column key={t} label={AI_TASK_LABELS[t]} hint={`Consignes propres à « ${AI_TASK_LABELS[t].toLowerCase()} ».`}>
            <TextArea defaultValue={settings.taskInstructions[t] ?? ''} style={{ minHeight: 64 }}
              onBlur={(e) => (settings.taskInstructions[t] ?? '') !== e.target.value && void save({ taskInstructions: { ...settings.taskInstructions, [t]: e.target.value } })} />
          </Row>
        ))}
      </Group>
    </>
  )
}
