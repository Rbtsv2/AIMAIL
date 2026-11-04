import type { AiProvider } from '@shared/ai/AiProvider'
import type { AiProviderConfig } from '@shared/ai/AiSettings'
import { Credentials } from '../../auth/Credentials'
import { OllamaProvider } from './OllamaProvider'
import { AnthropicProvider } from './AnthropicProvider'
import { OpenAIProvider } from './OpenAIProvider'

export function createProvider(cfg: AiProviderConfig): AiProvider {
  switch (cfg.kind) {
    case 'ollama': return new OllamaProvider(cfg.baseUrl)
    case 'anthropic': return new AnthropicProvider(Credentials.getAiKey('anthropic') ?? '')
    case 'openai': return new OpenAIProvider(Credentials.getAiKey('openai') ?? '', cfg.baseUrl)
  }
}
