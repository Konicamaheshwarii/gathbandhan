import { Observable } from 'rxjs';
import { Contribution, NewContribution, Wedding } from '../models';

export interface RepositoryChange {
  /** The wedding whose data changed, or null when everything may have changed (reset). */
  weddingId: string | null;
}

/**
 * Persistence boundary. Pages and stores only talk to this abstract class, which doubles as
 * the DI token. The app ships with a localStorage implementation so it runs on static hosting;
 * an HTTP implementation (for example NestJS + Postgres) can be provided in app.config.ts
 * without touching any component.
 */
export abstract class WeddingRepository {
  abstract listWeddings(): Promise<Wedding[]>;
  abstract getWeddingBySlug(slug: string): Promise<Wedding | null>;
  /** Creates or updates. Returns the stored wedding (its slug may be made unique). */
  abstract saveWedding(wedding: Wedding): Promise<Wedding>;
  abstract deleteWedding(id: string): Promise<void>;

  abstract listContributions(weddingId: string): Promise<Contribution[]>;
  abstract addContribution(input: NewContribution): Promise<Contribution>;
  abstract updateContribution(id: string, patch: Partial<Pick<Contribution, 'status' | 'thankedAt'>>): Promise<Contribution>;
  abstract deleteContribution(id: string): Promise<void>;

  /** Restores the bundled sample wedding. */
  abstract resetDemo(): Promise<void>;

  /** Emits when data changes in this tab or another one (live blessing wall). */
  abstract changes(): Observable<RepositoryChange>;
}
