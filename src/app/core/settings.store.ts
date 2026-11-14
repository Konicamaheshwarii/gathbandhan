import { Injectable, computed, effect, signal } from '@angular/core';
import { readJson, writeJson } from './storage';

/** 'auto' = free AI with no key (Chrome built-in AI, then Pollinations, then offline templates). */
export type ProviderId = 'auto' | 'demo' | 'gemini' | 'groq';
export type KeyProvider = 'gemini' | 'groq';

export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  provider: ProviderId;
  theme: Theme;
  apiKeys: Partial<Record<KeyProvider, string>>;
  models: Record<KeyProvider, string>;
  /** Allow the free Pollinations.ai text service (text leaves the browser). */
  allowCloudAi: boolean;
  /** Decorative AI images from Pollinations on invites. Off by default. */
  aiImages: boolean;
  version?: number;
}

export const PROVIDERS: { id: ProviderId; label: string; keyUrl?: string }[] = [
  { id: 'auto', label: 'Free AI (no key)' },
  { id: 'demo', label: 'Offline only' },
  { id: 'gemini', label: 'Google Gemini', keyUrl: 'https://aistudio.google.com/apikey' },
  { id: 'groq', label: 'Groq', keyUrl: 'https://console.groq.com/keys' },
];

export const DEFAULT_SETTINGS: Settings = {
  provider: 'auto',
  theme: 'system',
  apiKeys: {},
  models: { gemini: 'gemini-2.5-flash', groq: 'llama-3.3-70b-versatile' },
  allowCloudAi: true,
  aiImages: false,
  version: 2,
};

const KEY = 'sg.settings';

function load(): Settings {
  const saved = readJson<Partial<Settings>>(KEY, {});
  // Version 1 defaulted to the offline writer; free AI is the new default.
  const provider = !saved.version && (saved.provider === 'demo' || !saved.provider) ? 'auto' : saved.provider ?? 'auto';
  return { ...DEFAULT_SETTINGS, ...saved, provider, version: 2, models: { ...DEFAULT_SETTINGS.models, ...saved.models } };
}

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly state = signal<Settings>(load());

  readonly settings = this.state.asReadonly();
  readonly provider = computed(() => this.state().provider);
  /** Offline templates only. */
  readonly isDemo = computed(() => this.state().provider === 'demo');
  /** One line under every AI button saying who writes the text and where it goes. */
  readonly aiHint = computed(() => {
    const s = this.state();
    if (s.provider === 'demo') return 'Offline templates, no key needed. Nothing leaves this browser.';
    const free = s.allowCloudAi
      ? "Free AI: Chrome's on-device AI when available, otherwise Pollinations.ai (your text is sent to that free third-party service), otherwise offline templates."
      : "Free AI: Chrome's on-device AI when available, otherwise offline templates. Nothing is sent to other services.";
    if (s.provider === 'auto') return free;
    return `Uses your ${PROVIDERS.find((p) => p.id === s.provider)?.label} key, with ${s.allowCloudAi ? 'free' : 'on-device and offline'} fallbacks if it fails.`;
  });
  /** A real provider is selected but has no key yet. */
  readonly needsKey = computed(() => {
    const s = this.state();
    return (s.provider === 'gemini' || s.provider === 'groq') && !s.apiKeys[s.provider]?.trim();
  });

  constructor() {
    effect(() => writeJson(KEY, this.state()));
    effect(() => {
      const theme = this.state().theme;
      if (theme === 'system') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', theme);
    });
  }

  update(patch: Partial<Settings>): void {
    this.state.update((s) => ({ ...s, ...patch }));
  }

  setKey(provider: KeyProvider, key: string): void {
    this.state.update((s) => ({ ...s, apiKeys: { ...s.apiKeys, [provider]: key } }));
  }

  setModel(provider: KeyProvider, model: string): void {
    this.state.update((s) => ({ ...s, models: { ...s.models, [provider]: model } }));
  }
}
