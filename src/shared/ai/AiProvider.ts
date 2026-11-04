// src/shared/ai/AiProvider.ts
export type AiProviderKind = 'ollama' | 'anthropic' | 'openai'

export interface AiToolCall { id: string; name: string; args: Record<string, unknown> }

export interface AiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCalls?: AiToolCall[]
  toolCallId?: string
}

export interface AiTool {
  name: string
  description: string
  parameters: { type: 'object'; properties: Record<string, { type: string; description: string }>; required?: string[] }
}

export interface AiCompleteOptions {
  model: string
  messages: AiMessage[]
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
  tools?: AiTool[]
}

export interface AiStreamResult { text: string; toolCalls: AiToolCall[] }

export interface AiModelInfo {
  id: string
  label: string
}

export interface AiProvider {
  kind: AiProviderKind
  complete(opts: AiCompleteOptions): Promise<string>
  stream(opts: AiCompleteOptions, onToken: (t: string) => void): Promise<AiStreamResult>
  listModels(): Promise<AiModelInfo[]>
  healthcheck(): Promise<boolean>
}