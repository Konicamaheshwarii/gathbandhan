import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withHashLocation, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { LocalStorageWeddingRepository } from './core/data/local-storage.repository';
import { WeddingRepository } from './core/data/wedding.repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    // Hash routing keeps deep links working on GitHub Pages (no server-side rewrites).
    provideRouter(routes, withComponentInputBinding(), withHashLocation(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    // Swap for an HTTP implementation (e.g. NestJS + Postgres) without touching any component.
    { provide: WeddingRepository, useClass: LocalStorageWeddingRepository },
  ],
};
