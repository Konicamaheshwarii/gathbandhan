import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService, NoAuthService } from '../../core/auth/auth.service';
import { KEYS, LocalStorageWeddingRepository } from '../../core/data/local-storage.repository';
import { DEMO_ID, DEMO_SLUG } from '../../core/data/seed';
import { WeddingRepository } from '../../core/data/wedding.repository';
import { LocalProfileRepository, ProfileRepository } from '../../core/profile/profile.repository';
import { GuestsPage } from './guests.page';

describe('GuestsPage (guest list)', () => {
  let fixture: ComponentFixture<GuestsPage>;
  let repo: LocalStorageWeddingRepository;

  beforeEach(async () => {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    TestBed.configureTestingModule({
      imports: [GuestsPage],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: WeddingRepository, useClass: LocalStorageWeddingRepository },
        { provide: AuthService, useClass: NoAuthService },
        { provide: ProfileRepository, useClass: LocalProfileRepository },
      ],
    });
    repo = TestBed.inject(WeddingRepository) as LocalStorageWeddingRepository;
    fixture = TestBed.createComponent(GuestsPage);
    fixture.componentRef.setInput('slug', DEMO_SLUG);
    fixture.autoDetectChanges();
    for (let i = 0; i < 20 && !fixture.nativeElement.querySelector('li.guest'); i++) await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  });

  it('shows each guest\'s own invite language in their row (not the default)', async () => {
    const guests = await repo.listGuests(DEMO_ID);
    const withLanguage = guests.filter((g) => g.language && g.language !== 'english');
    expect(withLanguage.length).toBeGreaterThan(0);
    const el: HTMLElement = fixture.nativeElement;
    const selectFor = (name: string) =>
      [...el.querySelectorAll<HTMLSelectElement>('select.lang-pick')].find((s) => s.getAttribute('aria-label') === `Invite language for ${name}`)!;
    for (const g of withLanguage) expect(selectFor(g.name).value).withContext(g.name).toBe(g.language!);
    expect(selectFor(guests.find((g) => !g.language)!.name).value).toBe('');
  });
});
