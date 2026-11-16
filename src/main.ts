import { Provider } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { BACKEND_STATUS, BackendNotReady } from './app/core/backend-status';
import { RUNTIME_CONFIG, hasBackend, loadRuntimeConfig } from './app/core/config';

async function start(): Promise<void> {
  const config = await loadRuntimeConfig();
  const backend: Provider[] = [{ provide: RUNTIME_CONFIG, useValue: config }];
  if (hasBackend(config)) {
    try {
      const { supabaseProviders } = await import('./app/core/data/supabase/supabase-backend');
      backend.push(...(await supabaseProviders(config)));
    } catch (e) {
      // Tables not created yet, a paused project or no network: run in demo mode and say why.
      const reason = e instanceof BackendNotReady ? e.message : 'the online database could not be started';
      console.warn(`Gathbandhan is running in demo mode: ${reason}.`, e);
      backend.push({ provide: BACKEND_STATUS, useValue: { configured: true, online: false, reason } });
    }
  }
  // Later providers win, so the backend replaces the localStorage repository and no-op auth.
  await bootstrapApplication(App, { providers: [...appConfig.providers, ...backend] });
}

start().catch((err) => console.error(err));
