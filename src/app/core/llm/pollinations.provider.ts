import { LlmError, LlmProvider, LlmRequest } from './llm-provider';
import { truncateText } from '../text';

export const POLLINATIONS_TEXT_URL = 'https://text.pollinations.ai/';
/** The free tier allows about one reply every 45 seconds per IP address. */
export const POLLINATIONS_COOLDOWN_MS = 45_000;

let nextAllowedAt = 0;

/** Test hook. */
export function resetPollinationsCooldown(): void {
  nextAllowedAt = 0;
}

/**
 * Pollinations.ai: a free, keyless text API. The couple's text goes to a third-party service, so
 * the app says so next to every AI button and Settings can turn it off. The free tier is rate
 * limited (and only answers browsers on the published site), so while it is cooling down the
 * chain moves straight on to the offline templates instead of waiting.
 */
export class PollinationsProvider implements LlmProvider {
  constructor(private readonly fetchFn: typeof fetch = (...args) => fetch(...args), private readonly now = () => Date.now()) {}

  async complete(req: LlmRequest, signal?: AbortSignal): Promise<string> {
    if (this.now() < nextAllowedAt) {
      throw new LlmError(`The free AI allows one reply every 45 seconds; try again in ${Math.ceil((nextAllowedAt - this.now()) / 1000)} s.`);
    }
    nextAllowedAt = this.now() + POLLINATIONS_COOLDOWN_MS;
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
          referrer: 'gathbandhan',
          ...(req.json ? { jsonMode: true } : {}),
        }),
        signal,
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      throw new LlmError('The free AI service could not be reached.');
    }
    if (res.status === 402 || res.status === 429) {
      const wait = Number(res.headers.get('Retry-After')) || 45;
      nextAllowedAt = this.now() + wait * 1000;
      throw new LlmError(`The free AI is busy; it allows one reply every 45 seconds. Try again in ${wait} s.`, res.status);
    }
    if (!res.ok) throw new LlmError(`The free AI service is not available here (error ${res.status}).`, res.status);
    const raw = await res.text();
    let text = raw;
    try {
      // Some deployments answer in the OpenAI format; most answer with plain text.
      text = JSON.parse(raw)?.choices?.[0]?.message?.content ?? raw;
    } catch {
      // plain text reply
    }
    if (!text?.trim()) throw new LlmError('The free AI service returned nothing.');
    return text;
  }

  /** One reply streamed as a single chunk. */
  async *stream(req: LlmRequest, signal?: AbortSignal): AsyncIterable<string> {
    yield await this.complete(req, signal);
  }
}

/**
 * Decorative illustration from Pollinations' free image service. Off by default, clearly
 * labelled where it is used, and always over the CSS/SVG motifs so a failed image changes nothing.
 */
export function aiImageUrl(prompt: string, seed: number, width = 1080, height = 1920): string {
  const p = encodeURIComponent(truncateText(prompt.replace(/\s+/g, ' ').trim(), 300));
  return `https://image.pollinations.ai/prompt/${p}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux`;
}
