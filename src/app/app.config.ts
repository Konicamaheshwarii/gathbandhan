import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withHashLocation, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { AuthService, NoAuthService } from './core/auth/auth.service';
import { LocalStorageWeddingRepository } from './core/data/local-storage.repository';
import { WeddingRepository } from './core/data/wedding.repository';

/**
 * Demo-mode providers. When public/config.json has Supabase keys, main.ts appends the
 * Supabase repository and auth service, which replace these two.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    // Hash routing keeps deep links working on GitHub Pages (no server-side rewrites).
    provideRouter(routes, withComponentInputBinding(), withHashLocation(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    { provide: WeddingRepository, useClass: LocalStorageWeddingRepository },
    { provide: AuthService, useClass: NoAuthService },
  ],
};
