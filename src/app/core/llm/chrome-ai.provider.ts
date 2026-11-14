import { LlmError, LlmProvider, LlmRequest } from './llm-provider';

/** The subset of Chrome's built-in Prompt API (window.LanguageModel, Gemini Nano) that Shagun uses. */
interface PromptSession {
  prompt(input: string, options?: { signal?: AbortSignal }): Promise<string>;
  promptStreaming(input: string, options?: { signal?: AbortSignal }): AsyncIterable<string> | ReadableStream<string>;
  destroy?(): void;
}
export interface LanguageModelApi {
  availability(options?: unknown): Promise<'available' | 'downloadable' | 'downloading' | 'unavailable' | string>;
  create(options?: { initialPrompts?: { role: 'system' | 'user' | 'assistant'; content: string }[]; signal?: AbortSignal }): Promise<PromptSession>;
}

export function languageModelApi(): LanguageModelApi | null {
  const api = (globalThis as { LanguageModel?: LanguageModelApi }).LanguageModel;
  return api && typeof api.availability === 'function' ? api : null;
}

/** Gemini Nano writes English well; Hindi and Gujarati go to the next tier. */
export function chromeSupports(req: LlmRequest): boolean {
  return !req.language || req.language === 'english' || req.language === 'hinglish';
}

/**
 * On-device AI in desktop Chrome (138+). Free, private (nothing leaves the laptop) and no key.
 * Used only when the model is already downloaded: Shagun never triggers a multi-GB download.
 */
export class ChromeAiProvider implements LlmProvider {
  constructor(private readonly api: LanguageModelApi | null = languageModelApi()) {}

  async isAvailable(): Promise<boolean> {
    if (!this.api) return false;
    try {
      return (await this.api.availability()) === 'available';
    } catch {
      return false;
    }
  }

  private async session(req: LlmRequest, signal?: AbortSignal): Promise<PromptSession> {
    if (!this.api) throw new LlmError('Chrome built-in AI is not available in this browser.');
    const system = req.json ? `${req.system}\nReply with a single JSON object and nothing else.` : req.system;
    return this.api.create({ initialPrompts: [{ role: 'system', content: system }], signal });
  }

  async complete(req: LlmRequest, signal?: AbortSignal): Promise<string> {
    const s = await this.session(req, signal);
    try {
      return await s.prompt(req.prompt, { signal });
    } finally {
      s.destroy?.();
    }
  }

  async *stream(req: LlmRequest, signal?: AbortSignal): AsyncIterable<string> {
    const s = await this.session(req, signal);
    try {
      const stream = s.promptStreaming(req.prompt, { signal }) as AsyncIterable<string>;
      let soFar = '';
      for await (const chunk of stream) {
        // Early Chrome builds sent the whole text so far; current ones send only the new part.
        const delta = soFar && chunk.startsWith(soFar) ? chunk.slice(soFar.length) : chunk;
        soFar = soFar && chunk.startsWith(soFar) ? chunk : soFar + delta;
        if (delta) yield delta;
      }
    } finally {
      s.destroy?.();
    }
  }
}
