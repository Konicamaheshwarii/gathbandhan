import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { provideRouter, withComponentInputBinding, withHashLocation, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { AuthService, DemoAuthService } from './core/auth/auth.service';
import { LocalStorageWeddingRepository } from './core/data/local-storage.repository';
import { WeddingRepository } from './core/data/wedding.repository';
import { LocalProfileRepository, ProfileRepository } from './core/profile/profile.repository';

/**
 * Demo-mode providers. When public/config.json has Supabase keys, main.ts appends the
 * Supabase repositories and auth service, which replace these.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    // Hash routing keeps deep links working on GitHub Pages (no server-side rewrites).
    provideRouter(routes, withComponentInputBinding(), withHashLocation(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    { provide: WeddingRepository, useClass: LocalStorageWeddingRepository },
    // Demo mode: a local demo account for the account pages; no page asks for sign-in.
    { provide: AuthService, useClass: DemoAuthService },
    { provide: ProfileRepository, useClass: LocalProfileRepository },
    // Installable app: caches the app shell and assets so it opens offline (production builds only).
    provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:5000' }),
  ],
};
