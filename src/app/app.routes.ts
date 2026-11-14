import { Routes } from '@angular/router';
import { requireSignIn } from './core/auth/auth.service';

export const routes: Routes = [
  { path: '', title: 'Gathbandhan: wedding e-invites & digital shagun', loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage) },
  { path: 'login', title: 'Sign in · Gathbandhan', loadComponent: () => import('./features/login/login.page').then((m) => m.LoginPage) },
  { path: 'create', title: 'Create your page · Gathbandhan', canActivate: [requireSignIn], loadComponent: () => import('./features/editor/editor.page').then((m) => m.EditorPage) },
  { path: 'w/:slug', title: 'Bless the couple · Gathbandhan', loadComponent: () => import('./features/wedding/wedding.page').then((m) => m.WeddingPage) },
  { path: 'w/:slug/give', title: 'Give shagun · Gathbandhan', loadComponent: () => import('./features/give/give.page').then((m) => m.GivePage) },
  { path: 'w/:slug/rsvp', title: 'RSVP · Gathbandhan', loadComponent: () => import('./features/rsvp/rsvp.page').then((m) => m.RsvpPage) },
  { path: 'w/:slug/card', title: 'Venue QR card · Gathbandhan', loadComponent: () => import('./features/card/card.page').then((m) => m.CardPage) },
  { path: 'w/:slug/dashboard', title: 'Dashboard · Gathbandhan', canActivate: [requireSignIn], loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage) },
  { path: 'w/:slug/edit', title: 'Edit your page · Gathbandhan', canActivate: [requireSignIn], loadComponent: () => import('./features/editor/editor.page').then((m) => m.EditorPage) },
  { path: 'w/:slug/invite', title: 'Design your invite · Gathbandhan', canActivate: [requireSignIn], loadComponent: () => import('./features/invite/invite-designer.page').then((m) => m.InviteDesignerPage) },
  { path: 'w/:slug/guests', title: 'Guests and invites · Gathbandhan', canActivate: [requireSignIn], loadComponent: () => import('./features/guests/guests.page').then((m) => m.GuestsPage) },
  { path: 'i/:slug', title: "You're invited · Gathbandhan", loadComponent: () => import('./features/invite/invite-view.page').then((m) => m.InviteViewPage) },
  { path: 'i/:slug/:token', title: "You're invited · Gathbandhan", loadComponent: () => import('./features/invite/invite-view.page').then((m) => m.InviteViewPage) },
  { path: 'settings', title: 'Settings · Gathbandhan', loadComponent: () => import('./features/settings/settings.page').then((m) => m.SettingsPage) },
  { path: '**', redirectTo: '' },
];
