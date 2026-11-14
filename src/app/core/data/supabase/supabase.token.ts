import { InjectionToken } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';

/** The Supabase client, created in main.ts only when public/config.json has keys. */
export const SUPABASE_CLIENT = new InjectionToken<SupabaseClient>('SUPABASE_CLIENT');

export const PHOTO_BUCKET = 'shagun-photos';

/**
 * Table and function names in supabase/schema.sql. Everything is prefixed "shagun_" because the
 * Supabase project is shared with other apps.
 */
export const T = {
  weddings: 'shagun_weddings',
  owners: 'shagun_wedding_owners',
  contributions: 'shagun_contributions',
  rsvps: 'shagun_rsvps',
  guests: 'shagun_guests',
} as const;

export const RPC = {
  publicActivity: 'shagun_public_activity',
  guestInvite: 'shagun_guest_invite',
  guestMark: 'shagun_guest_mark',
} as const;
