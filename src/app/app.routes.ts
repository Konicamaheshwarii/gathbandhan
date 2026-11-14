import { Routes } from '@angular/router';
import { requireSignIn } from './core/auth/auth.service';

export const routes: Routes = [
  { path: '', title: 'Shagun: wedding wishlist by UPI', loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage) },
  { path: 'login', title: 'Sign in · Shagun', loadComponent: () => import('./features/login/login.page').then((m) => m.LoginPage) },
  { path: 'create', title: 'Create your page · Shagun', canActivate: [requireSignIn], loadComponent: () => import('./features/editor/editor.page').then((m) => m.EditorPage) },
  { path: 'w/:slug', title: 'Bless the couple · Shagun', loadComponent: () => import('./features/wedding/wedding.page').then((m) => m.WeddingPage) },
  { path: 'w/:slug/give', title: 'Give shagun · Shagun', loadComponent: () => import('./features/give/give.page').then((m) => m.GivePage) },
  { path: 'w/:slug/rsvp', title: 'RSVP · Shagun', loadComponent: () => import('./features/rsvp/rsvp.page').then((m) => m.RsvpPage) },
  { path: 'w/:slug/card', title: 'Venue QR card · Shagun', loadComponent: () => import('./features/card/card.page').then((m) => m.CardPage) },
  { path: 'w/:slug/dashboard', title: 'Dashboard · Shagun', canActivate: [requireSignIn], loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage) },
  { path: 'w/:slug/edit', title: 'Edit your page · Shagun', canActivate: [requireSignIn], loadComponent: () => import('./features/editor/editor.page').then((m) => m.EditorPage) },
  { path: 'settings', title: 'Settings · Shagun', loadComponent: () => import('./features/settings/settings.page').then((m) => m.SettingsPage) },
  { path: '**', redirectTo: '' },
];
