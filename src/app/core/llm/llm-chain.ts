import { LlmError, LlmProvider, LlmRequest } from './llm-provider';

/** Where an AI answer came from, best first. */
export type AiTier = 'byo' | 'chrome' | 'cloud' | 'offline';

export const TIER_LABELS: Record<AiTier, string> = {
  byo: 'your own key',
  chrome: "Chrome's on-device AI",
  cloud: 'free Pollinations AI',
  offline: 'offline templates',
};

export interface Tier {
  id: AiTier;
  label: string;
  provider: LlmProvider;
  timeoutMs: number;
  /** A tier may skip requests it handles badly (Chrome's model and Gujarati, for example). */
  supports?: (req: LlmRequest) => boolean;
}

export interface ChainResult<T> {
  value: T;
  tier: AiTier;
  /** Tiers that failed before this one answered, with why (shown as a hint, never as an error). */
  skipped: { tier: AiTier; reason: string }[];
}

/** Runs `fn` with its own abort signal that fires on timeout or when the caller aborts. */
export async function withTimeout<T>(ms: number, outer: AbortSignal | undefined, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort(outer?.reason);
  outer?.addEventListener('abort', onAbort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new LlmError(`No answer within ${Math.round(ms / 1000)} seconds.`));
      ctrl.abort();
    }, ms);
    // A provider that ignores its signal must not keep the caller waiting after an abort.
    ctrl.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });
  if (outer?.aborted) ctrl.abort(outer.reason);
  try {
    return await Promise.race([fn(ctrl.signal), timeout]);
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onAbort);
  }
}

/**
 * Tries each tier in order (own key → Chrome built-in AI → free cloud AI → offline templates).
 * A tier that errors, times out, or returns something `parse` rejects hands over to the next, so
 * the couple always gets an answer. Only a caller abort stops the chain.
 */
export class LlmChain {
  constructor(readonly tiers: Tier[]) {}

  async run<T>(req: LlmRequest, parse: (text: string) => T, signal?: AbortSignal): Promise<ChainResult<T>> {
    const skipped: ChainResult<T>['skipped'] = [];
    let last: unknown = null;
    for (const tier of this.tiers) {
      if (tier.supports && !tier.supports(req)) continue;
      try {
        const text = await withTimeout(tier.timeoutMs, signal, (s) => tier.provider.complete(req, s));
        return { value: parse(text), tier: tier.id, skipped };
      } catch (e) {
        if (signal?.aborted) throw e;
        last = e;
        skipped.push({ tier: tier.id, reason: (e as Error)?.message ?? String(e) });
      }
    }
    throw last instanceof Error ? last : new LlmError('No AI writer is available right now.');
  }

  /**
   * Streams from the first tier that produces text. A tier failing before its first chunk falls
   * through; once text has started, an error is passed on (half a story is better left visible).
   */
  async *stream(req: LlmRequest, signal?: AbortSignal, onTier?: (tier: AiTier) => void): AsyncIterable<string> {
    let last: unknown = null;
    for (const tier of this.tiers) {
      if (tier.supports && !tier.supports(req)) continue;
      const iterator = tier.provider.stream(req, signal)[Symbol.asyncIterator]();
      let first: IteratorResult<string>;
      try {
        first = await withTimeout(tier.timeoutMs, signal, () => iterator.next());
      } catch (e) {
        if (signal?.aborted) throw e;
        last = e;
        continue;
      }
      onTier?.(tier.id);
      if (first.done) return;
      yield first.value;
      for (let r = await iterator.next(); !r.done; r = await iterator.next()) yield r.value;
      return;
    }
    throw last instanceof Error ? last : new LlmError('No AI writer is available right now.');
  }
}
