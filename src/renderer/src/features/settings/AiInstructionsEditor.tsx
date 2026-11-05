// src/renderer/src/features/settings/AiInstructionsEditor.tsx
// Instructions de l'assistant : générales, par tâche (ajoutées), et consignes de base par tâche (remplacées).
import { useState } from 'react'
import { useAi } from '@/stores/ai.store'
import { AI_TASK_LABELS, type AiTask } from '@shared/ai/AiTask'
import { DEFAULT_TASK_PROMPTS } from '@shared/ai/prompts'
import { Group, Row, TextArea } from '@/design-system/Field'
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'

const TASKS: AiTask[] = ['reply', 'summarize', 'rewrite', 'translate', 'classify']
type BaseTask = AiTask | 'memory'
const BASE_TASKS: BaseTask[] = ['reply', 'rewrite', 'summarize', 'chat', 'classify', 'translate', 'memory']
const BASE_LABEL: Partial<Record<BaseTask, string>> = { chat: 'Conversation sur les messages', memory: 'Mémoire des fils anciens' }

export function AiInstructionsEditor() {
  const settings = useAi((s) => s.settings)
  const save = useAi((s) => s.save)
  const [showBase, setShowBase] = useState(false)
  if (!settings) return null
  const prompts: Partial<Record<BaseTask, string>> = settings.taskPrompts ?? {}
  return (
    <>
      <Group>
        <Row column label="Instructions générales" hint="Appliquées à chaque demande, quel que soit le compte ou la tâche. Qui vous êtes, votre style, ce qu’il faut toujours ou jamais faire.">
          <TextArea defaultValue={settings.globalInstructions} placeholder={'Ex. :\n- Phrases courtes, pas de jargon.\n- Ne jamais promettre de délai sans que je l’aie écrit.\n- Les mails en anglais restent en anglais.'} onBlur={(e) => e.target.value !== settings.globalInstructions && void save({ globalInstructions: e.target.value })} style={{ minHeight: 130 }} />
        </Row>
      </Group>
      <Group>
        {TASKS.map((t) => (
          <Row column key={t} label={AI_TASK_LABELS[t]} hint={`Consignes ajoutées pour « ${AI_TASK_LABELS[t].toLowerCase()} ».`}>
            <TextArea defaultValue={settings.taskInstructions[t] ?? ''} style={{ minHeight: 64 }}
              onBlur={(e) => (settings.taskInstructions[t] ?? '') !== e.target.value && void save({ taskInstructions: { ...settings.taskInstructions, [t]: e.target.value } })} />
          </Row>
        ))}
      </Group>
      <Group>
        <button className="sidebar-item" style={{ height: 34 }} onClick={() => setShowBase(!showBase)}>
          {showBase ? <ChevronDown size={14} /> : <ChevronRight size={14} />}<span className="label" style={{ fontWeight: 600 }}>Consignes de base (avancé)</span>
        </button>
        {showBase && (
          <>
            <div className="frow" style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)', lineHeight: 1.5 }}>
              Ce sont les consignes exactes envoyées au modèle pour chaque tâche. Les modifier change le comportement de fond de l’assistant ; « Réinitialiser » restaure le texte d’origine. Les instructions ci-dessus s’y ajoutent.
            </div>
            {BASE_TASKS.map((t) => {
              const custom = prompts[t]
              const value = custom ?? DEFAULT_TASK_PROMPTS[t] ?? ''
              return (
                <Row column key={t} label={BASE_LABEL[t] ?? AI_TASK_LABELS[t as AiTask]} hint={custom ? 'Modifiée' : 'Par défaut'}>
                  <TextArea key={`${t}-${custom ? 'c' : 'd'}`} defaultValue={value} style={{ minHeight: 120, fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--fs-xs)' }}
                    onBlur={(e) => { const v = e.target.value; if (v === value) return; void save({ taskPrompts: { ...prompts, [t]: v.trim() === (DEFAULT_TASK_PROMPTS[t] ?? '').trim() ? undefined : v } }) }} />
                  {custom && <button className="btn quiet" style={{ alignSelf: 'flex-start' }} onClick={() => void save({ taskPrompts: { ...prompts, [t]: undefined } })}><RotateCcw size={13} /> Réinitialiser</button>}
                </Row>
              )
            })}
          </>
        )}
      </Group>
    </>
  )
}