import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService, AuthUser, DEMO_USER_KEY, DemoAuthService, demoUserId } from '../auth/auth.service';
import { LocalStorageWeddingRepository } from '../data/local-storage.repository';
import { WeddingRepository } from '../data/wedding.repository';
import { wedding } from '../testing';
import {
  Profile, accountExport, cleanProfileInput, emptyProfile, exportFileName, formatPhone, greetingName, initialsOf, inviteLanguageOf,
  noteLanguageOf, normalizePhone, profileCompletion,
} from './profile.models';
import { LocalProfileRepository, PROFILE_KEY_PREFIX, ProfileRepository, ProfilesUnavailable } from './profile.repository';
import { ONBOARDING_SKIPPED_KEY, ProfileStore, onboardingTarget } from './profile.store';

const USER: AuthUser = { id: '11111111-1111-4111-8111-111111111111', email: 'riya@example.com' };

function clearStorage(): void {
  Object.keys(localStorage).filter((k) => k.startsWith('sg.')).forEach((k) => localStorage.removeItem(k));
}

describe('profile helpers', () => {
  it('reads phone numbers as E.164', () => {
    expect(normalizePhone('98765 43210')).toBe('+919876543210');
    expect(normalizePhone('098765-43210')).toBe('+919876543210');
    expect(normalizePhone('+91 98765 43210')).toBe('+919876543210');
    expect(normalizePhone('919876543210')).toBe('+919876543210');
    expect(normalizePhone('+44 7700 900123')).toBe('+447700900123');
    expect(normalizePhone('0044 7700 900123')).toBe('+447700900123');
    expect(normalizePhone('')).toBe('');
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('+0 123')).toBeNull();
    expect(formatPhone('+919876543210')).toBe('+91 98765 43210');
    expect(formatPhone('+447700900123')).toBe('+447700900123');
  });

  it('tidies and checks the editable fields', () => {
    const ok = cleanProfileInput({ fullName: '  Riya   Sharma ', phone: '9876543210', upiId: ' Riya@OKAXIS ', city: ' Jaipur ' }, { requireName: true });
    expect(ok.errors).toEqual({});
    expect(ok.value).toEqual(jasmine.objectContaining({ fullName: 'Riya Sharma', phone: '+919876543210', city: 'Jaipur' }));
    expect(ok.value.upiId).toBe('riya@okaxis');

    const bad = cleanProfileInput({ fullName: ' ', phone: '123', upiId: 'not a vpa', role: 'admin' as never, language: 'fr' as never }, { requireName: true });
    expect(Object.keys(bad.errors).sort()).toEqual(['fullName', 'language', 'phone', 'role', 'upiId']);
    expect(cleanProfileInput({ upiId: '' }).errors).toEqual({});
  });

  it('greets by display name, else the first name, and makes initials', () => {
    expect(greetingName({ displayName: 'Konu', fullName: 'Konica Maheshwari' })).toBe('Konu');
    expect(greetingName({ displayName: '', fullName: 'Konica Maheshwari' })).toBe('Konica');
    expect(greetingName(null)).toBe('');
    expect(initialsOf('Konica Maheshwari')).toBe('KM');
    expect(initialsOf('Riya')).toBe('R');
    expect(initialsOf('', 'konica@yopmail.com')).toBe('K');
  });

  it('maps the preferred language to invite and note languages', () => {
    expect(inviteLanguageOf('gu')).toBe('gujarati');
    expect(inviteLanguageOf('hi')).toBe('hindi');
    expect(inviteLanguageOf('hinglish')).toBe('hinglish');
    expect(inviteLanguageOf(null)).toBe('english');
    expect(noteLanguageOf('gu')).toBe('english');
    expect(noteLanguageOf('hi')).toBe('hindi');
  });

  it('measures completion', () => {
    expect(profileCompletion(null).done).toBe(0);
    const full: Profile = { ...emptyProfile('x'), fullName: 'A B', avatarUrl: 'u', role: 'bride', phone: '+919876543210', city: 'Pune', upiId: 'a@ok' };
    expect(profileCompletion(full)).toEqual({ done: 6, total: 6, missing: [] });
  });

  it('exports the profile and owned weddings, never the sample', () => {
    const p: Profile = { ...emptyProfile(USER.id), fullName: 'Riya', avatarUrl: 'data:image/jpeg;base64,xx' };
    const json = JSON.parse(accountExport(USER, p, [
      { wedding: wedding({ id: 'w1' }), access: 'owner' },
      { wedding: wedding({ id: 'demo', demo: true }), access: 'sample' },
    ], Date.UTC(2026, 10, 16)));
    expect(json.account).toEqual({ id: USER.id, email: USER.email });
    expect(json.profile.fullName).toBe('Riya');
    expect(json.profile.avatarUrl).toBe('(photo kept in this browser)');
    expect(json.weddings.length).toBe(1);
    expect(json.weddings[0].access).toBe('owner');
    expect(json.exportedAt).toBe('2026-11-16T00:00:00.000Z');
    expect(exportFileName(Date.UTC(2026, 10, 16))).toBe('gathbandhan-account-2026-11-16.json');
  });
});

describe('onboardingTarget', () => {
  it('sends a signed-in person without a profile to the welcome step, keeping where they were going', () => {
    expect(onboardingTarget('/account', 'missing', false)).toBe('/welcome?next=%2Faccount');
    expect(onboardingTarget('/create', 'missing', false)).toBe('/welcome?next=%2Fcreate');
    expect(onboardingTarget('/w/a-weds-b/dashboard', 'missing', false)).toBe('/welcome?next=%2Fw%2Fa-weds-b%2Fdashboard');
  });

  it('leaves everyone else alone', () => {
    expect(onboardingTarget('/account', 'ready', false)).toBeNull();
    expect(onboardingTarget('/account', 'loading', false)).toBeNull();
    expect(onboardingTarget('/account', 'unavailable', false)).toBeNull();
    expect(onboardingTarget('/account', 'signed-out', false)).toBeNull();
    expect(onboardingTarget('/account', 'missing', true)).toBeNull();
    expect(onboardingTarget('', 'missing', false)).toBeNull();
  });

  it('never interrupts sign-in, the welcome step itself, or guests', () => {
    for (const url of ['/login', '/login?next=%2Fcreate', '/welcome?next=%2F', '/w/a-weds-b', '/w/a-weds-b/give', '/w/a-weds-b/rsvp', '/i/a-weds-b/tok123']) {
      expect(onboardingTarget(url, 'missing', false)).withContext(url).toBeNull();
    }
  });
});

describe('DemoAuthService', () => {
  beforeEach(clearStorage);
  afterEach(clearStorage);

  it('signs in locally with a stable id per email, and signs out', async () => {
    const auth = new DemoAuthService();
    expect(auth.enabled).toBeFalse();
    expect(auth.accounts).toBeTrue();
    expect(auth.simulated).toBeTrue();
    await auth.sendMagicLink(' Riya@Example.com ', '/account');
    expect(auth.user()).toEqual({ id: demoUserId('riya@example.com'), email: 'riya@example.com' });
    expect(auth.user()!.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(new DemoAuthService().user()?.email).toBe('riya@example.com');
    await auth.signOutEverywhere();
    expect(auth.user()).toBeNull();
    expect(localStorage.getItem(DEMO_USER_KEY)).toBeNull();
    await expectAsync(auth.sendMagicLink('nope', '/')).toBeRejected();
  });
});

describe('LocalProfileRepository (demo mode)', () => {
  let repo: LocalProfileRepository;
  let weddings: LocalStorageWeddingRepository;

  beforeEach(() => {
    clearStorage();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: WeddingRepository, useClass: LocalStorageWeddingRepository },
        LocalProfileRepository,
      ],
    });
    repo = TestBed.inject(LocalProfileRepository);
    weddings = TestBed.inject(WeddingRepository) as LocalStorageWeddingRepository;
  });
  afterEach(clearStorage);

  it('has no profile at first, then creates and updates one', async () => {
    expect(await repo.get(USER)).toBeNull();
    const created = await repo.save(USER, { fullName: 'Riya Sharma', role: 'bride', language: 'hi' });
    expect(created.id).toBe(USER.id);
    expect(created.createdAt).toBeGreaterThan(0);
    const updated = await repo.save(USER, { city: 'Jaipur' });
    expect(updated.fullName).toBe('Riya Sharma');
    expect(updated.city).toBe('Jaipur');
    expect((await repo.get(USER))!.language).toBe('hi');
    expect(await repo.get({ id: 'someone-else', email: 'x@y.in' })).toBeNull();
  });

  it('stores the avatar as a data URL and removes it', async () => {
    const p = await repo.uploadAvatar(USER, 'data:image/jpeg;base64,/9j/AAAA');
    expect(p.avatarUrl).toContain('data:image/jpeg');
    expect((await repo.removeAvatar(USER)).avatarUrl).toBe('');
    await expectAsync(repo.uploadAvatar(USER, 'https://evil.example/x.jpg')).toBeRejected();
  });

  it('treats every page in this browser as owned', async () => {
    expect(await repo.weddingAccess(USER, ['a', 'b'])).toEqual({ a: 'owner', b: 'owner' });
  });

  it('deletes the profile, and the pages only when asked', async () => {
    await repo.save(USER, { fullName: 'Riya' });
    await weddings.saveWedding(wedding({ id: 'w-mine', slug: 'mine-weds-yours' }));
    const keep = await repo.deleteAccount(USER, { deleteWeddings: false });
    expect(keep.weddingsDeleted).toBe(0);
    expect(localStorage.getItem(`${PROFILE_KEY_PREFIX}${USER.id}`)).toBeNull();
    expect((await weddings.listWeddings()).some((w) => w.id === 'w-mine')).toBeTrue();

    const gone = await repo.deleteAccount(USER, { deleteWeddings: true });
    expect(gone.weddingsDeleted).toBe(1);
    const left = await weddings.listWeddings();
    expect(left.some((w) => w.id === 'w-mine')).toBeFalse();
    expect(left.some((w) => w.demo)).withContext('the sample stays').toBeTrue();
  });
});

describe('ProfileStore', () => {
  class FakeAuth extends AuthService {
    readonly enabled = true;
    readonly accounts = true;
    readonly user = signal<AuthUser | null>(null);
    sendMagicLink = jasmine.createSpy('send').and.resolveTo();
    verifyCode = jasmine.createSpy('verify').and.resolveTo();
    signOut = jasmine.createSpy('signOut').and.callFake(async () => this.user.set(null));
  }
  let auth: FakeAuth;
  let repo: jasmine.SpyObj<ProfileRepository>;
  let store: ProfileStore;

  const settle = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
    TestBed.tick();
  };

  beforeEach(() => {
    clearStorage();
    auth = new FakeAuth();
    repo = jasmine.createSpyObj<ProfileRepository>('repo', ['get', 'save', 'uploadAvatar', 'removeAvatar', 'weddingAccess', 'deleteAccount']);
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: AuthService, useValue: auth }, { provide: ProfileRepository, useValue: repo }],
    });
    store = TestBed.inject(ProfileStore);
  });
  afterEach(clearStorage);

  it('is signed out, then missing after a first sign-in, then ready once saved', async () => {
    repo.get.and.resolveTo(null);
    TestBed.tick();
    expect(store.status()).toBe('signed-out');
    auth.user.set(USER);
    await settle();
    expect(store.status()).toBe('missing');
    expect(store.needsOnboarding()).toBeTrue();
    expect(store.nudge()).toBeTrue();
    expect(store.label()).toBe('riya');
    expect(store.initials()).toBe('R');

    repo.save.and.resolveTo({ ...emptyProfile(USER.id), fullName: 'Riya Sharma', language: 'gu' });
    await store.save({ fullName: 'Riya Sharma' });
    expect(store.status()).toBe('ready');
    expect(store.needsOnboarding()).toBeFalse();
    expect(store.nudge()).toBeFalse();
    expect(store.name()).toBe('Riya');
    expect(store.initials()).toBe('RS');
    expect(store.inviteLanguage()).toBe('gujarati');
  });

  it('remembers "Skip for now" per person, and keeps nudging', async () => {
    repo.get.and.resolveTo(null);
    auth.user.set(USER);
    await settle();
    store.skip();
    expect(store.needsOnboarding()).toBeFalse();
    expect(store.nudge()).toBeTrue();
    expect(JSON.parse(localStorage.getItem(ONBOARDING_SKIPPED_KEY)!)).toEqual([USER.id]);
  });

  it('carries on without profiles when the server has no table yet', async () => {
    repo.get.and.rejectWith(new ProfilesUnavailable('no table'));
    auth.user.set(USER);
    await settle();
    expect(store.status()).toBe('unavailable');
    expect(store.needsOnboarding()).toBeFalse();
  });

  it('deletes the account, then signs out', async () => {
    repo.get.and.resolveTo({ ...emptyProfile(USER.id), fullName: 'Riya' });
    repo.deleteAccount.and.resolveTo({ weddingsDeleted: 2, weddingsLeft: 0 });
    auth.user.set(USER);
    await settle();
    const r = await store.deleteAccount({ deleteWeddings: true });
    expect(repo.deleteAccount).toHaveBeenCalledOnceWith(USER, { deleteWeddings: true });
    expect(r.weddingsDeleted).toBe(2);
    expect(auth.signOut).toHaveBeenCalled();
    await settle();
    expect(store.status()).toBe('signed-out');
  });
});
