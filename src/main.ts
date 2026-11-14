import { Provider } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { hasBackend, loadRuntimeConfig } from './app/core/config';

async function start(): Promise<void> {
  const config = await loadRuntimeConfig();
  let backend: Provider[] = [];
  if (hasBackend(config)) {
    try {
      const { supabaseProviders } = await import('./app/core/data/supabase/supabase-backend');
      backend = await supabaseProviders(config);
    } catch (e) {
      // A broken backend config should not take the site down: fall back to demo mode.
      console.error('Supabase could not start, staying in demo mode.', e);
    }
  }
  // Later providers win, so the backend replaces the localStorage repository and no-op auth.
  await bootstrapApplication(App, { providers: [...appConfig.providers, ...backend] });
}

start().catch((err) => console.error(err));
