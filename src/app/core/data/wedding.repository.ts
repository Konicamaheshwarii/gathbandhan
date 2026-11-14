import { Observable } from 'rxjs';
import { Contribution, Guest, GuestInvite, GuestMark, NewContribution, NewRsvp, PublicActivity, Rsvp, Wedding } from '../models';

export interface RepositoryChange {
  /** The wedding whose data changed, or null when everything may have changed (reset). */
  weddingId: string | null;
}

/** Where data lives: this browser only, or the shared Supabase backend. */
export type RepositoryMode = 'local' | 'supabase';

/**
 * Persistence boundary. Pages and stores only talk to this abstract class, which doubles as
 * the DI token. `LocalStorageWeddingRepository` runs on static hosting with no backend;
 * `SupabaseWeddingRepository` is provided instead when `public/config.json` has Supabase keys.
 *
 * Reads split into a public part anyone may see (the wedding page and `getPublicActivity`) and
 * an owner part (`listContributions`, `listRsvps`) that the backend restricts to the couple.
 */
export abstract class WeddingRepository {
  abstract readonly mode: RepositoryMode;

  /** Weddings this browser (demo mode) or the signed-in couple (backend) can manage. */
  abstract listWeddings(): Promise<Wedding[]>;
  abstract getWeddingBySlug(slug: string): Promise<Wedding | null>;
  /** Creates or updates. Returns the stored wedding (its slug may be made unique, photos uploaded). */
  abstract saveWedding(wedding: Wedding): Promise<Wedding>;
  abstract deleteWedding(id: string): Promise<void>;
  /** Whether the current visitor may edit the wedding and see its dashboard. */
  abstract isOwner(weddingId: string): Promise<boolean>;

  /** Totals and the blessing wall, without phone numbers (or amounts, when the couple hides them). */
  abstract getPublicActivity(weddingId: string): Promise<PublicActivity>;
  /** Owner only: every contribution with amounts and phone numbers. */
  abstract listContributions(weddingId: string): Promise<Contribution[]>;
  abstract addContribution(input: NewContribution): Promise<Contribution>;
  abstract updateContribution(id: string, patch: Partial<Pick<Contribution, 'status' | 'thankedAt'>>): Promise<Contribution>;
  abstract deleteContribution(id: string): Promise<void>;

  /** Owner only. */
  abstract listRsvps(weddingId: string): Promise<Rsvp[]>;
  abstract addRsvp(input: NewRsvp): Promise<Rsvp>;
  abstract deleteRsvp(id: string): Promise<void>;

  /** Owner only: the guest list for invites. */
  abstract listGuests(weddingId: string): Promise<Guest[]>;
  /** Owner only: creates or updates guests (import, edits, "sent" ticks). */
  abstract saveGuests(guests: Guest[]): Promise<void>;
  abstract deleteGuest(id: string): Promise<void>;
  /** Anyone with the personal link: that one guest's greeting, nothing else. */
  abstract getGuestInvite(weddingId: string, token: string): Promise<GuestInvite | null>;
  /** Anyone with the personal link: records that the guest opened the invite, RSVP'd or gave shagun. */
  abstract markGuest(weddingId: string, token: string, mark: GuestMark): Promise<void>;

  /** Co-owners by email (backend only; demo mode has no accounts). */
  abstract listOwners(weddingId: string): Promise<string[]>;
  abstract addOwner(weddingId: string, email: string): Promise<void>;
  abstract removeOwner(weddingId: string, email: string): Promise<void>;

  /** Restores the bundled sample wedding. */
  abstract resetDemo(): Promise<void>;

  /** Emits when data changes in this tab, another tab or (backend) another device. */
  abstract changes(): Observable<RepositoryChange>;

  /**
   * Starts live updates for one wedding (the backend subscribes to realtime changes).
   * Returns a function that stops them. Local storage is always live, so the default does nothing.
   */
  watch(_weddingId: string): () => void {
    return () => undefined;
  }
}
