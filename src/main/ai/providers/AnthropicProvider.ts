// src/main/ai/providers/AnthropicProvider.ts
import Anthropic from '@anthropic-ai/sdk'
import type { AiProvider, AiCompleteOptions, AiModelInfo, AiStreamResult, AiToolCall } from '@shared/ai/AiProvider'

export class AnthropicProvider implements AiProvider {
  kind = 'anthropic' as const
  private client: Anthropic
  constructor(apiKey: string) { this.client = new Anthropic({ apiKey }) }

  private split(o: AiCompleteOptions) {
    const system = o.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
    const messages: any[] = []
    for (const m of o.messages) {
      if (m.role === 'system') continue
      if (m.role === 'tool') {
        const block = { type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }
        const last = messages[messages.length - 1]
        if (last && last.role === 'user' && Array.isArray(last.content) && last.content[0]?.type === 'tool_result') last.content.push(block)
        else messages.push({ role: 'user', content: [block] })
        continue
      }
      if (m.role === 'assistant' && m.toolCalls?.length) {
        messages.push({ role: 'assistant', content: [...(m.content ? [{ type: 'text', text: m.content }] : []), ...m.toolCalls.map((c) => ({ type: 'tool_use', id: c.id, name: c.name, input: c.args }))] })
        continue
      }
      messages.push({ role: m.role, content: m.content })
    }
    const tools = o.tools?.length ? o.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })) : undefined
    return { system, messages, tools }
  }

  async complete(o: AiCompleteOptions): Promise<string> {
    const { system, messages, tools } = this.split(o)
    const r = await this.client.messages.create({ model: o.model, max_tokens: o.maxTokens ?? 1024, temperature: o.temperature ?? 0.4, system, messages, tools: tools as any }, { signal: o.signal })
    return r.content.filter((c) => c.type === 'text').map((c: any) => c.text).join('')
  }

  async stream(o: AiCompleteOptions, onToken: (t: string) => void): Promise<AiStreamResult> {
    const { system, messages, tools } = this.split(o)
    const s = this.client.messages.stream({ model: o.model, max_tokens: o.maxTokens ?? 1024, temperature: o.temperature ?? 0.4, system, messages, tools: tools as any }, { signal: o.signal })
    let full = ''
    s.on('text', (t) => { full += t; onToken(t) })
    const final = await s.finalMessage()
    const toolCalls: AiToolCall[] = final.content.filter((c: any) => c.type === 'tool_use').map((c: any) => ({ id: c.id, name: c.name, args: c.input ?? {} }))
    return { text: full, toolCalls }
  }

  async listModels(): Promise<AiModelInfo[]> {
    const r = await this.client.models.list()
    return r.data.map((m) => ({ id: m.id, label: m.display_name ?? m.id }))
  }

  async healthcheck(): Promise<boolean> {
    try { await this.client.models.list({ limit: 1 }); return true } catch { return false }
  }
}