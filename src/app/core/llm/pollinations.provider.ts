import { LlmError, LlmProvider, LlmRequest } from './llm-provider';

export const POLLINATIONS_TEXT_URL = 'https://text.pollinations.ai/openai';

/**
 * Pollinations.ai: a free, keyless text API (OpenAI-compatible). The couple's text goes to a
 * third-party service, so the app says so next to every AI button and Settings can turn it off.
 */
export class PollinationsProvider implements LlmProvider {
  constructor(private readonly fetchFn: typeof fetch = (...args) => fetch(...args)) {}

  async complete(req: LlmRequest, signal?: AbortSignal): Promise<string> {
    let res: Response;
    try {
      res = await this.fetchFn(POLLINATIONS_TEXT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai',
          messages: [
            { role: 'system', content: req.json ? `${req.system}\nReply with a single JSON object and nothing else.` : req.system },
            { role: 'user', content: req.prompt },
          ],
          private: true,
          referrer: 'shagun-wishlist',
          ...(req.json ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal,
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      throw new LlmError('The free AI service could not be reached.');
    }
    if (!res.ok) throw new LlmError(`The free AI service is busy (error ${res.status}).`, res.status);
    const raw = await res.text();
    let text = raw;
    try {
      text = JSON.parse(raw)?.choices?.[0]?.message?.content ?? raw;
    } catch {
      // plain text reply
    }
    if (!text?.trim()) throw new LlmError('The free AI service returned nothing.');
    return text;
  }

  /** The free endpoint is fast enough that one reply streamed as a single chunk feels fine. */
  async *stream(req: LlmRequest, signal?: AbortSignal): AsyncIterable<string> {
    yield await this.complete(req, signal);
  }
}

/**
 * Decorative illustration from Pollinations' free image service. Off by default, clearly
 * labelled where it is used, and always over the CSS/SVG motifs so a failed image changes nothing.
 */
export function aiImageUrl(prompt: string, seed: number, width = 1080, height = 1920): string {
  const p = encodeURIComponent(prompt.replace(/\s+/g, ' ').trim().slice(0, 300));
  return `https://image.pollinations.ai/prompt/${p}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux`;
}
