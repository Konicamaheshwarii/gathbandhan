import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService, AuthUser } from '../core/auth/auth.service';
import { Profile, emptyProfile } from '../core/profile/profile.models';
import { ProfileRepository } from '../core/profile/profile.repository';
import { AccountMenuComponent } from './account-menu.component';

const USER: AuthUser = { id: 'u1', email: 'konica@yopmail.com' };

class FakeAuth extends AuthService {
  readonly enabled = true;
  readonly accounts = true;
  readonly user = signal<AuthUser | null>(null);
  sendMagicLink = jasmine.createSpy('send').and.resolveTo();
  verifyCode = jasmine.createSpy('verify').and.resolveTo();
  signOut = jasmine.createSpy('signOut').and.callFake(async () => this.user.set(null));
}

describe('AccountMenuComponent (header)', () => {
  let auth: FakeAuth;
  let fixture: ComponentFixture<AccountMenuComponent>;
  let el: HTMLElement;
  let profile: Profile | null;

  const settle = async () => {
    TestBed.tick();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    TestBed.tick();
    fixture.detectChanges();
  };

  beforeEach(() => {
    auth = new FakeAuth();
    profile = null;
    const repo = jasmine.createSpyObj<ProfileRepository>('profiles', ['get']);
    repo.get.and.callFake(async () => profile);
    TestBed.configureTestingModule({
      imports: [AccountMenuComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([]), { provide: AuthService, useValue: auth }, { provide: ProfileRepository, useValue: repo }],
    });
    spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(AccountMenuComponent);
    el = fixture.nativeElement;
    document.body.appendChild(el);
  });
  afterEach(() => {
    fixture.destroy();
    el.remove();
  });

  const trigger = () => el.querySelector<HTMLButtonElement>('.trigger')!;

  it('offers "Sign in" when signed out', async () => {
    await settle();
    expect(el.querySelector('a.sign-in')!.getAttribute('href')).toBe('/login');
    expect(trigger()).toBeNull();
  });

  it('shows initials, the first name and a nudge until the profile has a name', async () => {
    profile = { ...emptyProfile('u1'), fullName: 'Konica Maheshwari' };
    auth.user.set(USER);
    await settle();
    expect(trigger().textContent).toContain('Konica');
    expect(trigger().querySelector('.initials')!.textContent).toContain('KM');
    expect(el.querySelector('.nudge-dot')).toBeNull();
  });

  it('falls back to the email name with a "complete your profile" nudge', async () => {
    auth.user.set(USER);
    await settle();
    expect(trigger().textContent).toContain('konica');
    expect(el.querySelector('.nudge-dot')).not.toBeNull();
    trigger().click();
    fixture.detectChanges();
    expect(el.querySelector('.item.nudge')!.textContent).toContain('Complete your profile');
  });

  it('opens a menu with My account, My wedding pages and Sign out', async () => {
    profile = { ...emptyProfile('u1'), fullName: 'Konica Maheshwari', avatarUrl: 'data:image/jpeg;base64,xx' };
    auth.user.set(USER);
    await settle();
    expect(trigger().querySelector('img')).not.toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    trigger().click();
    fixture.detectChanges();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    const items = [...el.querySelectorAll<HTMLElement>('[role=menuitem]')];
    expect(items.map((i) => i.textContent!.trim())).toEqual(['My account', 'My wedding pages', 'Sign out']);
    expect(items[0].getAttribute('href')).toBe('/account');
    expect(items[1].getAttribute('href')).toBe('/account#weddings');
    expect(el.querySelector('.who')!.textContent).toContain('konica@yopmail.com');
  });

  it('moves focus to the first item when the menu opens, as the app renders it', async () => {
    profile = { ...emptyProfile('u1'), fullName: 'Konica Maheshwari' };
    auth.user.set(USER);
    await settle();
    fixture.autoDetectChanges();
    trigger().click();
    await fixture.whenStable();
    const items = [...el.querySelectorAll<HTMLElement>('[role=menuitem]')];
    expect(items.length).toBe(3);
    expect(document.activeElement).toBe(items[0]);
    items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items[1]);
  });

  it('closes on Escape and on a click outside', async () => {
    auth.user.set(USER);
    await settle();
    trigger().click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el.querySelector('[role=menu]')).toBeNull();
    trigger().click();
    fixture.detectChanges();
    document.body.click();
    fixture.detectChanges();
    expect(el.querySelector('[role=menu]')).toBeNull();
  });

  it('signs out from the menu', async () => {
    auth.user.set(USER);
    await settle();
    trigger().click();
    fixture.detectChanges();
    [...el.querySelectorAll<HTMLButtonElement>('[role=menuitem]')].find((b) => b.textContent!.includes('Sign out'))!.click();
    await settle();
    expect(auth.signOut).toHaveBeenCalled();
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/');
    expect(el.querySelector('a.sign-in')).not.toBeNull();
  });
});
