// src/main/ai/providers/OpenAIProvider.ts
import OpenAI from 'openai'
import type { AiProvider, AiCompleteOptions, AiModelInfo, AiMessage, AiStreamResult, AiToolCall } from '@shared/ai/AiProvider'

const toOpenAI = (m: AiMessage): any => {
  if (m.role === 'tool') return { role: 'tool', tool_call_id: m.toolCallId, content: m.content }
  if (m.role === 'assistant' && m.toolCalls?.length) return { role: 'assistant', content: m.content || null, tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } })) }
  return { role: m.role, content: m.content }
}

export class OpenAIProvider implements AiProvider {
  kind = 'openai' as const
  private client: OpenAI
  constructor(apiKey: string, baseURL?: string) { this.client = new OpenAI({ apiKey, baseURL }) }

  private params(o: AiCompleteOptions) {
    return {
      model: o.model, messages: o.messages.map(toOpenAI), temperature: o.temperature ?? 0.4, max_tokens: o.maxTokens ?? 1024,
      tools: o.tools?.length ? o.tools.map((t) => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.parameters } })) : undefined
    }
  }

  async complete(o: AiCompleteOptions): Promise<string> {
    const r = await this.client.chat.completions.create(this.params(o), { signal: o.signal })
    return r.choices[0]?.message?.content ?? ''
  }

  async stream(o: AiCompleteOptions, onToken: (t: string) => void): Promise<AiStreamResult> {
    const s = await this.client.chat.completions.create({ ...this.params(o), stream: true }, { signal: o.signal })
    let full = ''
    const partial = new Map<number, { id: string; name: string; args: string }>()
    for await (const chunk of s) {
      const d = chunk.choices[0]?.delta
      const t = d?.content ?? ''
      if (t) { full += t; onToken(t) }
      for (const tc of d?.tool_calls ?? []) {
        const p = partial.get(tc.index) ?? { id: '', name: '', args: '' }
        if (tc.id) p.id = tc.id
        if (tc.function?.name) p.name += tc.function.name
        if (tc.function?.arguments) p.args += tc.function.arguments
        partial.set(tc.index, p)
      }
    }
    const toolCalls: AiToolCall[] = [...partial.values()].map((p) => ({ id: p.id, name: p.name, args: (() => { try { return JSON.parse(p.args || '{}') } catch { return {} } })() }))
    return { text: full, toolCalls }
  }

  async listModels(): Promise<AiModelInfo[]> {
    const r = await this.client.models.list()
    return r.data.filter((m) => /gpt|o\d/.test(m.id)).map((m) => ({ id: m.id, label: m.id })).sort((a, b) => a.id.localeCompare(b.id))
  }

  async healthcheck(): Promise<boolean> {
    try { await this.client.models.list(); return true } catch { return false }
  }
}