import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService, AuthUser } from '../../core/auth/auth.service';
import { WeddingRepository } from '../../core/data/wedding.repository';
import { MyWedding, Profile, emptyProfile } from '../../core/profile/profile.models';
import { ProfileRepository } from '../../core/profile/profile.repository';
import { ProfileStore } from '../../core/profile/profile.store';
import { wedding } from '../../core/testing';
import { AccountPage } from './account.page';
import { CROP_VIEW, clampCrop, cropSource } from './avatar-cropper.component';
import { CONFIRM_WORD, DeleteAccountComponent } from './delete-account.component';
import { WelcomePage } from './welcome.page';

const USER: AuthUser = { id: '11111111-1111-4111-8111-111111111111', email: 'riya@example.com' };

class FakeAuth extends AuthService {
  readonly enabled = true;
  readonly accounts = true;
  readonly user = signal<AuthUser | null>(USER);
  sendMagicLink = jasmine.createSpy('send').and.resolveTo();
  verifyCode = jasmine.createSpy('verify').and.resolveTo();
  signOut = jasmine.createSpy('signOut').and.callFake(async () => this.user.set(null));
  override signOutEverywhere = jasmine.createSpy('signOutEverywhere').and.callFake(async () => this.user.set(null));
}

function fakeProfiles(start: Profile | null): jasmine.SpyObj<ProfileRepository> & { current: Profile | null } {
  const repo = jasmine.createSpyObj<ProfileRepository>('profiles', ['get', 'save', 'uploadAvatar', 'removeAvatar', 'weddingAccess', 'deleteAccount']) as
    jasmine.SpyObj<ProfileRepository> & { current: Profile | null };
  repo.current = start;
  (repo as { mode: string }).mode = 'supabase';
  repo.get.and.callFake(async () => repo.current);
  repo.save.and.callFake(async (_u, input) => (repo.current = { ...(repo.current ?? emptyProfile(USER.id)), ...input }));
  repo.uploadAvatar.and.callFake(async (_u, url) => (repo.current = { ...(repo.current ?? emptyProfile(USER.id)), avatarUrl: url, avatarPath: 'x' }));
  repo.removeAvatar.and.callFake(async () => (repo.current = { ...(repo.current ?? emptyProfile(USER.id)), avatarUrl: '', avatarPath: '' }));
  repo.weddingAccess.and.resolveTo({ w1: 'owner', w2: 'co-owner' });
  repo.deleteAccount.and.resolveTo({ weddingsDeleted: 1, weddingsLeft: 1 });
  return repo;
}

const settle = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
  TestBed.tick();
};

describe('AccountPage', () => {
  let auth: FakeAuth;
  let profiles: ReturnType<typeof fakeProfiles>;
  let fixture: ComponentFixture<AccountPage>;
  let el: HTMLElement;
  let router: Router;

  async function render(start: Profile | null = { ...emptyProfile(USER.id), fullName: 'Riya Sharma', role: 'bride', phone: '+919876543210', createdAt: Date.UTC(2026, 9, 1) }) {
    auth = new FakeAuth();
    profiles = fakeProfiles(start);
    const weddings = jasmine.createSpyObj<WeddingRepository>('weddings', ['listWeddings']);
    weddings.listWeddings.and.resolveTo([
      wedding({ id: 'w1', slug: 'riya-weds-arjun-2', partner1: 'Riya Sharma', partner2: 'Arjun Mehta' }),
      wedding({ id: 'w2', slug: 'neha-weds-dev', partner1: 'Neha', partner2: 'Dev' }),
      wedding({ id: 'demo', slug: 'riya-weds-arjun', demo: true }),
    ]);
    TestBed.configureTestingModule({
      imports: [AccountPage],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ProfileRepository, useValue: profiles },
        { provide: WeddingRepository, useValue: weddings },
      ],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(AccountPage);
    el = fixture.nativeElement;
    await settle();
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
  }

  afterEach(() => fixture?.destroy());

  const section = (id: string) => el.querySelector<HTMLElement>(`#${id}`)!;
  const type = (selector: string, value: string) => {
    const input = el.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };

  it('greets by name and shows every section', async () => {
    await render();
    expect(el.querySelector('.hero h1')!.textContent).toContain('Namaste, Riya');
    expect(el.querySelector('.hero-meta')!.textContent).toContain('riya@example.com');
    for (const id of ['profile', 'payments', 'weddings', 'notifications', 'security', 'privacy']) {
      expect(section(id)).withContext(id).not.toBeNull();
    }
    expect(el.querySelectorAll('.toc button').length).toBe(6);
    expect(el.querySelector<HTMLInputElement>('input[name=phone]')!.value).toBe('+91 98765 43210');
    expect(section('notifications').textContent).toContain("We don't send these emails yet");
  });

  it('saves the profile, rejecting a bad phone first', async () => {
    await render();
    type('input[name=city]', 'Jaipur');
    type('input[name=phone]', '12345');
    fixture.detectChanges();
    section('profile').querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
    fixture.detectChanges();
    expect(profiles.save).not.toHaveBeenCalled();
    expect(section('profile').textContent).toContain('10-digit mobile number');

    type('input[name=phone]', '98290 12345');
    section('profile').querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
    fixture.detectChanges();
    expect(profiles.save).toHaveBeenCalledWith(USER, jasmine.objectContaining({ city: 'Jaipur', phone: '+919829012345', fullName: 'Riya Sharma', role: 'bride' }));
    expect(section('profile').querySelector('.saved')!.textContent).toContain('Saved');
  });

  it('saves the default UPI ID and payee name', async () => {
    await render();
    type('input[name=upiId]', 'Riya@OKAXIS');
    type('input[name=payeeName]', 'Riya Sharma');
    section('payments').querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
    expect(profiles.save).toHaveBeenCalledWith(USER, { upiId: 'riya@okaxis', payeeName: 'Riya Sharma' });
    expect(section('payments').querySelector('app-upi-qr-reader')).not.toBeNull();
  });

  it('lists wedding pages with owner, co-owner and sample, and quick links', async () => {
    await render();
    const rows = [...section('weddings').querySelectorAll('.page-row')];
    expect(rows.length).toBe(3);
    expect(rows[0].textContent).toContain('Owner');
    expect(rows[1].textContent).toContain('Co-owner');
    expect(rows[2].textContent).toContain('Sample');
    const links = [...rows[0].querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/w/riya-weds-arjun-2', '/w/riya-weds-arjun-2/dashboard', '/w/riya-weds-arjun-2/invite', '/w/riya-weds-arjun-2/guests']);
    expect(section('weddings').querySelector('a.create')!.getAttribute('href')).toBe('/create');
  });

  it('stores notification choices', async () => {
    await render();
    const rsvp = el.querySelector<HTMLInputElement>('[data-test=notify-rsvp]')!;
    expect(rsvp.checked).toBeTrue();
    rsvp.checked = false;
    rsvp.dispatchEvent(new Event('change'));
    await settle();
    expect(profiles.save).toHaveBeenCalledWith(USER, { notifyRsvp: false });
  });

  it('signs out of all devices', async () => {
    await render();
    el.querySelector<HTMLButtonElement>('[data-test=signout-global]')!.click();
    await settle();
    expect(auth.signOutEverywhere).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('downloads the profile and owned pages as JSON', async () => {
    await render();
    let saved: { name: string; blob: Blob } | null = null;
    spyOn(URL, 'createObjectURL').and.callFake((b) => {
      saved = { name: '', blob: b as Blob };
      return 'blob:x';
    });
    spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) {
      saved!.name = this.download;
    });
    el.querySelector<HTMLButtonElement>('[data-test=download]')!.click();
    await settle();
    expect(saved!.name).toMatch(/^gathbandhan-account-\d{4}-\d{2}-\d{2}\.json$/);
    const data = JSON.parse(await saved!.blob.text());
    expect(data.profile.fullName).toBe('Riya Sharma');
    expect(data.weddings.map((w: { id: string; access: string }) => `${w.id}:${w.access}`)).toEqual(['w1:owner', 'w2:co-owner']);
  });

  it('deletes the account only after the typed confirmation', async () => {
    await render();
    el.querySelector<HTMLButtonElement>('[data-test=delete-open]')!.click();
    fixture.detectChanges();
    const confirm = el.querySelector<HTMLButtonElement>('[data-test=delete-confirm]')!;
    expect(confirm.disabled).toBeTrue();
    expect(section('privacy').textContent).toContain('Riya & Arjun');
    expect(section('privacy').textContent).toContain('stay with the other owners');
    const box = el.querySelector<HTMLInputElement>('[data-test=delete-weddings]')!;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    type('[data-test=delete-word]', 'delete');
    fixture.detectChanges();
    expect(confirm.disabled).toBeFalse();
    confirm.click();
    await settle();
    expect(profiles.deleteAccount).toHaveBeenCalledOnceWith(USER, { deleteWeddings: true });
    expect(auth.signOut).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('shows a failed deletion without signing out', async () => {
    await render();
    profiles.deleteAccount.and.rejectWith(new Error('Account deletion is not switched on yet'));
    el.querySelector<HTMLButtonElement>('[data-test=delete-open]')!.click();
    fixture.detectChanges();
    type('[data-test=delete-word]', CONFIRM_WORD);
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('[data-test=delete-confirm]')!.click();
    await settle();
    fixture.detectChanges();
    expect(section('privacy').querySelector('[role=alert]')!.textContent).toContain('not switched on yet');
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});

describe('DeleteAccountComponent', () => {
  let fixture: ComponentFixture<DeleteAccountComponent>;
  let el: HTMLElement;
  let emitted: { deleteWeddings: boolean }[];

  function render(weddings: MyWedding[]) {
    TestBed.configureTestingModule({ imports: [DeleteAccountComponent], providers: [provideZonelessChangeDetection()] });
    fixture = TestBed.createComponent(DeleteAccountComponent);
    fixture.componentRef.setInput('weddings', weddings);
    emitted = [];
    fixture.componentInstance.confirmed.subscribe((v) => emitted.push(v));
    fixture.detectChanges();
    el = fixture.nativeElement;
  }
  const type = (v: string) => {
    const i = el.querySelector<HTMLInputElement>('[data-test=delete-word]')!;
    i.value = v;
    i.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  it('starts closed, and needs the exact word', () => {
    render([{ wedding: wedding(), access: 'owner' }]);
    expect(el.querySelector('[data-test=delete-confirm]')).toBeNull();
    el.querySelector<HTMLButtonElement>('[data-test=delete-open]')!.click();
    fixture.detectChanges();
    type('DELET');
    expect(el.querySelector<HTMLButtonElement>('[data-test=delete-confirm]')!.disabled).toBeTrue();
    type(' delete ');
    el.querySelector<HTMLButtonElement>('[data-test=delete-confirm]')!.click();
    expect(emitted).toEqual([{ deleteWeddings: false }]);
  });

  it('keeps pages by default and can be cancelled', () => {
    render([{ wedding: wedding(), access: 'owner' }]);
    el.querySelector<HTMLButtonElement>('[data-test=delete-open]')!.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Your pages stay online');
    [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.includes('Keep my account'))!.click();
    fixture.detectChanges();
    expect(el.querySelector('[data-test=delete-word]')).toBeNull();
    expect(emitted).toEqual([]);
  });

  it('offers no page choice when nothing is owned', () => {
    render([{ wedding: wedding({ demo: true }), access: 'sample' }]);
    el.querySelector<HTMLButtonElement>('[data-test=delete-open]')!.click();
    fixture.detectChanges();
    expect(el.querySelector('[data-test=delete-weddings]')).toBeNull();
  });
});

describe('WelcomePage (onboarding)', () => {
  let profiles: ReturnType<typeof fakeProfiles>;
  let fixture: ComponentFixture<WelcomePage>;
  let el: HTMLElement;
  let router: Router;

  async function render(next = '/create') {
    profiles = fakeProfiles(null);
    TestBed.configureTestingModule({
      imports: [WelcomePage],
      providers: [provideZonelessChangeDetection(), provideRouter([]), { provide: AuthService, useValue: new FakeAuth() }, { provide: ProfileRepository, useValue: profiles }],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(WelcomePage);
    fixture.componentRef.setInput('next', next);
    el = fixture.nativeElement;
    await settle();
    fixture.detectChanges();
  }
  afterEach(() => fixture?.destroy());

  it('needs a name, then saves name, role, phone and language and goes on to next', async () => {
    await render('/create');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
    fixture.detectChanges();
    expect(profiles.save).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Please add your name');

    const name = el.querySelector<HTMLInputElement>('input[name=fullName]')!;
    name.value = 'Riya Sharma';
    name.dispatchEvent(new Event('input'));
    [...el.querySelectorAll<HTMLButtonElement>('.choice')].find((b) => b.textContent!.includes('Bride'))!.click();
    [...el.querySelectorAll<HTMLButtonElement>('.choice')].find((b) => b.textContent!.includes('ગુજરાતી'))!.click();
    fixture.detectChanges();
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
    expect(profiles.save).toHaveBeenCalledWith(USER, { fullName: 'Riya Sharma', role: 'bride', phone: '', language: 'gu' });
    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/create');
  });

  it('can be skipped, which remembers the choice', async () => {
    await render('/w/a-weds-b/dashboard');
    [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.includes('Skip for now'))!.click();
    await settle();
    expect(TestBed.inject(ProfileStore).skipped()).toBeTrue();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/w/a-weds-b/dashboard');
    localStorage.removeItem('sg.onboardingSkipped');
  });

  it('falls back to the account page for an unsafe next', async () => {
    await render('//evil.example');
    [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.includes('Skip for now'))!.click();
    await settle();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/account');
    localStorage.removeItem('sg.onboardingSkipped');
  });
});

describe('avatar crop math', () => {
  it('covers the circle at zoom 1 and crops the centre square', () => {
    const r = cropSource(1000, 500, { zoom: 1, x: 0, y: 0 });
    expect(r.size).toBeCloseTo(500);
    expect(r.sx).toBeCloseTo(250);
    expect(r.sy).toBeCloseTo(0);
  });

  it('never pans past the photo edge', () => {
    const c = clampCrop(1000, 500, { zoom: 1, x: 9999, y: 50 });
    expect(c.y).toBe(0);
    expect(c.x).toBeCloseTo((1000 * (CROP_VIEW / 500) - CROP_VIEW) / 2);
    const r = cropSource(1000, 500, { zoom: 1, x: 9999, y: 0 });
    expect(r.sx).toBeCloseTo(0);
  });

  it('zooms in up to 3x', () => {
    expect(clampCrop(400, 400, { zoom: 9, x: 0, y: 0 }).zoom).toBe(3);
    const r = cropSource(400, 400, { zoom: 2, x: 0, y: 0 });
    expect(r.size).toBeCloseTo(200);
    expect(r.sx).toBeCloseTo(100);
  });
});
