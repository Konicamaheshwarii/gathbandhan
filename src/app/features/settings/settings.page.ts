import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BACKEND_STATUS } from '../../core/backend-status';
import { WeddingRepository } from '../../core/data/wedding.repository';
import { TIER_LABELS } from '../../core/llm/llm-chain';
import { LlmService } from '../../core/llm/llm.service';
import { PwaService } from '../../core/pwa.service';
import { KeyProvider, PROVIDERS, ProviderId, SettingsStore, Theme } from '../../core/settings.store';
import { ToastService } from '../../shared/toast.service';

@Component({
  selector: 'app-settings',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
})
export class SettingsPage {
  protected readonly store = inject(SettingsStore);
  private readonly llm = inject(LlmService);
  private readonly repo = inject(WeddingRepository);
  private readonly toast = inject(ToastService);

  protected readonly providers = PROVIDERS;
  protected readonly backend = this.repo.mode === 'supabase';
  protected readonly backendStatus = inject(BACKEND_STATUS);
  protected readonly pwa = inject(PwaService);
  protected readonly themes: Theme[] = ['system', 'light', 'dark'];
  protected readonly current = computed(() => PROVIDERS.find((p) => p.id === this.store.provider())!);
  protected readonly real = computed<KeyProvider | null>(() => {
    const p = this.store.provider();
    return p === 'gemini' || p === 'groq' ? p : null;
  });
  protected readonly chrome = signal<'checking' | 'yes' | 'no'>('checking');
  protected readonly test = signal<{ state: 'idle' | 'running' | 'ok' | 'fail'; message?: string }>({ state: 'idle' });

  constructor() {
    void this.llm.chromeAvailable().then((ok) => this.chrome.set(ok ? 'yes' : 'no'));
  }

  protected choose(id: ProviderId): void {
    this.store.update({ provider: id });
    this.test.set({ state: 'idle' });
  }

  protected setKey(value: string): void {
    this.store.setKey(this.real()!, value.trim());
    this.test.set({ state: 'idle' });
  }

  protected setModel(value: string): void {
    if (value.trim()) this.store.setModel(this.real()!, value.trim());
  }

  /** Checks the first tier that would answer, and says which one it was. */
  protected async testConnection(): Promise<void> {
    this.test.set({ state: 'running' });
    try {
      const result = await this.llm.run(
        { task: 'ping', json: true, system: 'You are a health check.', prompt: 'Reply with JSON only: {"ok":true}' },
        (t) => {
          if (!t.trim()) throw new Error('Empty reply.');
          return t;
        },
      );
      const via = TIER_LABELS[result.tier];
      const failed = result.skipped.map((s) => `${TIER_LABELS[s.tier]}: ${s.reason}`).join(' ');
      this.test.set(
        result.tier === 'offline' && this.store.provider() !== 'demo'
          ? { state: 'fail', message: `No online AI answered, so offline templates will be used. ${failed}` }
          : { state: 'ok', message: `Working. Answers come from ${via}.${failed ? ` (Skipped: ${failed})` : ''}` },
      );
    } catch (e) {
      this.test.set({ state: 'fail', message: (e as Error).message });
    }
  }

  protected clearKey(): void {
    this.store.setKey(this.real()!, '');
  }

  protected async resetDemo(): Promise<void> {
    await this.repo.resetDemo();
    this.toast.show('Sample wedding restored');
  }
}
