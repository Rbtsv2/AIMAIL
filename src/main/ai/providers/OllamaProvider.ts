// src/main/ai/providers/OllamaProvider.ts
import type { AiProvider, AiCompleteOptions, AiModelInfo, AiMessage, AiStreamResult, AiToolCall } from '@shared/ai/AiProvider'

const toOllama = (m: AiMessage) => {
  if (m.role === 'tool') return { role: 'tool', content: m.content }
  if (m.role === 'assistant' && m.toolCalls?.length) return { role: 'assistant', content: m.content, tool_calls: m.toolCalls.map((c) => ({ function: { name: c.name, arguments: c.args } })) }
  return { role: m.role, content: m.content }
}
const parseCalls = (tc: any[] | undefined): AiToolCall[] =>
  (tc ?? []).map((c, i) => ({ id: `call_${Date.now()}_${i}`, name: c.function?.name ?? '', args: typeof c.function?.arguments === 'string' ? safeJson(c.function.arguments) : (c.function?.arguments ?? {}) }))
const safeJson = (s: string): Record<string, unknown> => { try { return JSON.parse(s) } catch { return {} } }

export class OllamaProvider implements AiProvider {
  kind = 'ollama' as const
  constructor(private baseUrl = 'http://127.0.0.1:11434') {}

  private body(o: AiCompleteOptions, stream: boolean) {
    return JSON.stringify({
      model: o.model, messages: o.messages.map(toOllama), stream,
      tools: o.tools?.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
      keep_alive: '30m',
      options: { temperature: o.temperature ?? 0.4, num_predict: o.maxTokens ?? 1024, num_ctx: 16384 }
    })
  }

  async complete(o: AiCompleteOptions): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/chat`, { method: 'POST', signal: o.signal, body: this.body(o, false) })
    if (!res.ok) throw await this.err(res)
    return ((await res.json()) as any).message?.content ?? ''
  }

  async stream(o: AiCompleteOptions, onToken: (t: string) => void): Promise<AiStreamResult> {
    const res = await fetch(`${this.baseUrl}/api/chat`, { method: 'POST', signal: o.signal, body: this.body(o, true) })
    if (!res.ok || !res.body) throw await this.err(res)
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = '', full = ''
    const toolCalls: AiToolCall[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const lines = buf.split('\n'); buf = lines.pop() ?? ''
      for (const l of lines) {
        if (!l.trim()) continue
        const j = JSON.parse(l)
        const t = j.message?.content ?? ''
        if (t) { full += t; onToken(t) }
        if (j.message?.tool_calls) toolCalls.push(...parseCalls(j.message.tool_calls))
      }
    }
    return { text: full, toolCalls }
  }

  private async err(res: Response): Promise<Error> {
    let detail = ''
    try { detail = ((await res.json()) as any)?.error ?? '' } catch {}
    const e: any = new Error(detail || `ollama ${res.status}`)
    e.status = res.status
    return e
  }

  async listModels(): Promise<AiModelInfo[]> {
    const res = await fetch(`${this.baseUrl}/api/tags`)
    const j = (await res.json()) as any
    return (j.models ?? []).map((m: any) => ({ id: m.name, label: m.name }))
  }

  // précharge le modèle pour éviter la latence de chargement à la première question
  async warm(model: string): Promise<void> {
    try { await fetch(`${this.baseUrl}/api/generate`, { method: 'POST', body: JSON.stringify({ model, prompt: '', keep_alive: '30m' }), signal: AbortSignal.timeout(60000) }) } catch {}
  }

  async healthcheck(): Promise<boolean> {
    try { const r = await fetch(`${this.baseUrl}/api/tags`); return r.ok } catch { return false }
  }
}