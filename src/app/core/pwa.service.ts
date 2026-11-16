import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { readJson, writeJson } from './storage';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'sg.installDismissed';
const EARLY_PROMPT = '__gathbandhanInstallPrompt';

/**
 * Chrome can fire `beforeinstallprompt` while main.ts is still loading config.json, before
 * Angular (and PwaService) exist; a missed event means no install button at all. main.ts calls
 * this first thing, and PwaService picks the kept event up.
 */
export function captureEarlyInstallPrompt(target: Pick<Window, 'addEventListener' | 'removeEventListener'> = globalThis as unknown as Window): void {
  const keep = (e: Event) => {
    e.preventDefault();
    (globalThis as Record<string, unknown>)[EARLY_PROMPT] = e;
  };
  target.addEventListener('beforeinstallprompt', keep);
  (globalThis as Record<string, unknown>)[`${EARLY_PROMPT}Stop`] = () => target.removeEventListener('beforeinstallprompt', keep);
}

function takeEarlyInstallPrompt(): InstallPromptEvent | null {
  const g = globalThis as Record<string, unknown>;
  (g[`${EARLY_PROMPT}Stop`] as (() => void) | undefined)?.();
  const e = (g[EARLY_PROMPT] as InstallPromptEvent | undefined) ?? null;
  delete g[EARLY_PROMPT];
  delete g[`${EARLY_PROMPT}Stop`];
  return e;
}

export function isIosDevice(ua = navigator.userAgent, touchPoints = navigator.maxTouchPoints): boolean {
  // iPadOS reports itself as a Mac, so touch support tells the two apart.
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && touchPoints > 1);
}

export function isStandalone(): boolean {
  return (
    globalThis.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Installable-app state: Android/desktop Chrome's install prompt, iPhone's "Add to Home Screen"
 * instructions, whether we already run as an app, online/offline, and new-version notices.
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly updates = inject(SwUpdate, { optional: true });
  private deferred: InstallPromptEvent | null = null;

  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  readonly standalone = signal(isStandalone());
  readonly canPrompt = signal(false);
  readonly ios = isIosDevice();
  readonly dismissed = signal(readJson<boolean>(DISMISSED_KEY, false));
  readonly updateReady = signal(false);
  readonly showIosHelp = signal(false);

  constructor() {
    const early = takeEarlyInstallPrompt();
    if (early) {
      this.deferred = early;
      this.canPrompt.set(true);
    }
    const onPrompt = (e: Event) => {
      e.preventDefault(); // show our own button instead of the mini-infobar
      this.deferred = e as InstallPromptEvent;
      this.canPrompt.set(true);
    };
    const onInstalled = () => {
      this.deferred = null;
      this.canPrompt.set(false);
      this.standalone.set(true);
    };
    const onOnline = () => this.online.set(true);
    const onOffline = () => this.online.set(false);
    const standaloneQuery = globalThis.matchMedia?.('(display-mode: standalone)');
    const onDisplay = () => this.standalone.set(isStandalone());
    addEventListener('beforeinstallprompt', onPrompt);
    addEventListener('appinstalled', onInstalled);
    addEventListener('online', onOnline);
    addEventListener('offline', onOffline);
    standaloneQuery?.addEventListener?.('change', onDisplay);
    inject(DestroyRef).onDestroy(() => {
      removeEventListener('beforeinstallprompt', onPrompt);
      removeEventListener('appinstalled', onInstalled);
      removeEventListener('online', onOnline);
      removeEventListener('offline', onOffline);
      standaloneQuery?.removeEventListener?.('change', onDisplay);
    });

    if (this.updates?.isEnabled) {
      this.updates.versionUpdates.subscribe((e) => {
        if (e.type === 'VERSION_READY') this.updateReady.set(true);
      });
      this.updates.unrecoverable.subscribe(() => this.updateReady.set(true));
      // Look for a new version when the app comes back to the foreground.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void this.updates?.checkForUpdate().catch(() => false);
      });
    }
  }

  /** Whether to offer installing (hidden once installed or dismissed). */
  offerInstall(): boolean {
    return !this.standalone() && !this.dismissed() && (this.canPrompt() || this.ios);
  }

  async install(): Promise<void> {
    if (this.deferred) {
      await this.deferred.prompt();
      const choice = await this.deferred.userChoice.catch(() => null);
      if (choice?.outcome === 'accepted') this.canPrompt.set(false);
      this.deferred = null;
    } else if (this.ios) {
      this.showIosHelp.set(true);
    }
  }

  dismiss(): void {
    this.dismissed.set(true);
    this.showIosHelp.set(false);
    writeJson(DISMISSED_KEY, true);
  }

  async applyUpdate(): Promise<void> {
    try {
      await this.updates?.activateUpdate();
    } finally {
      location.reload();
    }
  }
}
