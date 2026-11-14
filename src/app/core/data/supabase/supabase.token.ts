import { InjectionToken } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';

/** The Supabase client, created in main.ts only when public/config.json has keys. */
export const SUPABASE_CLIENT = new InjectionToken<SupabaseClient>('SUPABASE_CLIENT');

export const PHOTO_BUCKET = 'wedding-photos';
