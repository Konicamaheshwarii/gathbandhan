import { Injectable, inject, signal } from '@angular/core';
import { SettingsStore } from '../settings.store';
import { ChromeAiProvider, chromeSupports } from './chrome-ai.provider';
import { DemoProvider } from './demo.provider';
import { GeminiProvider } from './gemini.provider';
import { GroqProvider } from './groq.provider';
import { AiTier, ChainResult, LlmChain, TIER_LABELS, Tier } from './llm-chain';
import { LlmRequest } from './llm-provider';
import { PollinationsProvider } from './pollinations.provider';

/**
 * Picks who writes, automatically: the couple's own key (Gemini or Groq) if they added one, then
 * Chrome's on-device AI if this browser has it, then the free Pollinations service (if allowed in
 * Settings), and finally the offline templates, which always answer.
 */
@Injectable({ providedIn: 'root' })
export class LlmService {
  private readonly settings = inject(SettingsStore);
  private readonly chrome = new ChromeAiProvider();
  private chromeReady: Promise<boolean> | null = null;

  /** Which tier wrote the last answer (shown as "Written by …"). */
  readonly lastTier = signal<AiTier | null>(null);

  /** Whether Chrome's on-device model is ready (checked once; it never triggers a download). */
  chromeAvailable(): Promise<boolean> {
    return (this.chromeReady ??= this.chrome.isAvailable());
  }

  async chain(): Promise<LlmChain> {
    const s = this.settings.settings();
    const tiers: Tier[] = [];
    if (s.provider === 'gemini' && s.apiKeys.gemini?.trim()) {
      tiers.push({ id: 'byo', label: 'Google Gemini', provider: new GeminiProvider(s.apiKeys.gemini.trim(), s.models.gemini), timeoutMs: 45_000 });
    }
    if (s.provider === 'groq' && s.apiKeys.groq?.trim()) {
      tiers.push({ id: 'byo', label: 'Groq', provider: new GroqProvider(s.apiKeys.groq.trim(), s.models.groq), timeoutMs: 45_000 });
    }
    if (s.provider !== 'demo') {
      if (await this.chromeAvailable()) {
        tiers.push({ id: 'chrome', label: TIER_LABELS.chrome, provider: this.chrome, timeoutMs: 30_000, supports: chromeSupports });
      }
      if (s.allowCloudAi) tiers.push({ id: 'cloud', label: TIER_LABELS.cloud, provider: new PollinationsProvider(), timeoutMs: 25_000 });
    }
    tiers.push({ id: 'offline', label: TIER_LABELS.offline, provider: new DemoProvider(), timeoutMs: 10_000 });
    return new LlmChain(tiers);
  }

  /** Completes and parses; a reply that fails `parse` counts as a failure and moves down the chain. */
  async run<T>(req: LlmRequest, parse: (text: string) => T, signal?: AbortSignal): Promise<ChainResult<T>> {
    const result = await (await this.chain()).run(req, parse, signal);
    this.lastTier.set(result.tier);
    return result;
  }

  async complete(req: LlmRequest, signal?: AbortSignal): Promise<string> {
    return (await this.run(req, (t) => t, signal)).value;
  }

  async *stream(req: LlmRequest, signal?: AbortSignal): AsyncIterable<string> {
    const chain = await this.chain();
    yield* chain.stream(req, signal, (tier) => this.lastTier.set(tier));
  }
}
