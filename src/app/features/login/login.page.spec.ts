import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService, AuthUser } from '../../core/auth/auth.service';
import { EMPTY_CONFIG, RUNTIME_CONFIG } from '../../core/config';
import { LoginPage, RESEND_SECONDS, clock, purposeFor, safeNext } from './login.page';

class FakeAuth extends AuthService {
  readonly enabled = true;
  readonly accounts = true;
  readonly user = signal<AuthUser | null>(null);
  readonly sendMagicLink = jasmine.createSpy('sendMagicLink').and.resolveTo();
  readonly verifyCode = jasmine.createSpy('verifyCode').and.resolveTo();
  readonly signOut = jasmine.createSpy('signOut').and.resolveTo();
}

describe('LoginPage', () => {
  let auth: FakeAuth;
  let fixture: ComponentFixture<LoginPage>;
  let el: HTMLElement;

  beforeEach(() => {
    jasmine.clock().install();
    auth = new FakeAuth();
    TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [provideZonelessChangeDetection(), provideRouter([]), { provide: AuthService, useValue: auth }],
    });
  });

  /** Spies on navigation; called by render(), so a test can still override providers first. */
  function spyNavigation(): void {
    const router = TestBed.inject(Router);
    if (!jasmine.isSpy(router.navigateByUrl)) spyOn(router, 'navigateByUrl').and.resolveTo(true);
  }

  afterEach(() => {
    fixture?.destroy();
    jasmine.clock().uninstall();
  });

  async function settle(): Promise<void> {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  }

  function render(next?: string): void {
    spyNavigation();
    fixture = TestBed.createComponent(LoginPage);
    if (next !== undefined) fixture.componentRef.setInput('next', next);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  function sendTo(email: string): void {
    const input = el.querySelector<HTMLInputElement>('input[type=email]')!;
    input.value = email;
    input.dispatchEvent(new Event('input'));
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
  }

  const resendButton = () => el.querySelector<HTMLButtonElement>('button.resend')!;

  it('says what the couple is signing in for, from the next param', () => {
    render('/create');
    expect(el.querySelector('.login-card h1')!.textContent).toContain('Welcome to Gathbandhan');
    expect(el.querySelector('.sub')!.textContent).toContain('Sign in to create your wedding page');
    fixture.componentRef.setInput('next', '/w/riya-weds-arjun/dashboard');
    fixture.detectChanges();
    expect(el.querySelector('.sub')!.textContent).toContain('open your dashboard');
  });

  it('shows the benefits and the trust lines', () => {
    render('/create');
    const text = el.textContent!;
    expect(text).toContain('Design your kankotri in 4 languages');
    expect(text).toContain('No password. We email you a secure link.');
    expect(text).toContain('Guests never need an account.');
  });

  it('rejects an invalid email without calling the backend', async () => {
    render('/create');
    sendTo('not-an-email');
    await settle();
    fixture.detectChanges();
    expect(auth.sendMagicLink).not.toHaveBeenCalled();
    expect(el.querySelector('[role=alert]')!.textContent).toContain('valid email');
  });

  it('moves to the "check your email" state with mail links and a resend countdown', async () => {
    render('/create');
    sendTo('riya@example.com');
    await settle();
    fixture.detectChanges();

    expect(auth.sendMagicLink).toHaveBeenCalledOnceWith('riya@example.com', '/create');
    expect(el.querySelector('.sent h1')!.textContent).toContain('Check your email');
    expect(el.querySelector('.sent .addr')!.textContent).toContain('riya@example.com');
    const links = [...el.querySelectorAll<HTMLAnchorElement>('.mail-apps a')].map((a) => a.href);
    expect(links.some((h) => h.startsWith('https://mail.google.com'))).toBeTrue();
    expect(links.some((h) => h.includes('outlook'))).toBeTrue();

    expect(resendButton().disabled).toBeTrue();
    expect(resendButton().textContent).toContain('You can resend in 1:00');
    jasmine.clock().tick(1000);
    fixture.detectChanges();
    expect(resendButton().textContent).toContain('0:59');

    jasmine.clock().tick((RESEND_SECONDS - 1) * 1000);
    fixture.detectChanges();
    expect(resendButton().disabled).toBeFalse();
    expect(resendButton().textContent).toContain('Resend the link');

    resendButton().click();
    await settle();
    fixture.detectChanges();
    expect(auth.sendMagicLink).toHaveBeenCalledTimes(2);
    expect(resendButton().disabled).toBeTrue();
  });

  it('explains the email limit kindly when Supabase rate-limits a resend', async () => {
    render('/create');
    sendTo('riya@example.com');
    await settle();
    jasmine.clock().tick(RESEND_SECONDS * 1000);
    auth.sendMagicLink.and.rejectWith(new Error('Too many sign-in emails just now. Wait a minute, then try again.'));
    fixture.detectChanges();
    resendButton().click();
    await settle();
    fixture.detectChanges();
    const alert = el.querySelector('.alert.friendly')!;
    expect(alert.textContent).toContain('couple of sign-in emails an hour');
    expect(el.querySelector('.sent')).not.toBeNull();
  });

  it('offers no code on the free plan, where the email carries only the link', async () => {
    render('/create');
    sendTo('riya@example.com');
    await settle();
    fixture.detectChanges();
    expect(el.querySelector('.sent')).not.toBeNull();
    expect(el.textContent).not.toContain('Have a code');
    expect(el.querySelector('.code-input')).toBeNull();

    jasmine.clock().tick(RESEND_SECONDS * 1000);
    auth.sendMagicLink.and.rejectWith(new Error('Too many sign-in emails just now. Wait a minute, then try again.'));
    fixture.detectChanges();
    resendButton().click();
    await settle();
    fixture.detectChanges();
    expect(el.querySelector('.alert.friendly')!.textContent).toContain('The link in the email we already sent still works.');
    expect(el.querySelector('.alert.friendly')!.textContent).not.toContain('code');
  });

  it('verifies the 6-digit code when the owner added it to the email', async () => {
    TestBed.overrideProvider(RUNTIME_CONFIG, { useValue: { ...EMPTY_CONFIG, signInCode: true } });
    render('/create');
    sendTo('riya@example.com');
    await settle();
    fixture.detectChanges();
    expect(el.querySelector('.code-input')).toBeNull();
    [...el.querySelectorAll<HTMLButtonElement>('.link')].find((b) => b.textContent!.includes('Have a code'))!.click();
    fixture.detectChanges();
    const code = el.querySelector<HTMLInputElement>('.code-input')!;
    expect(code.getAttribute('autocomplete')).toBe('one-time-code');
    code.value = '123456';
    code.dispatchEvent(new Event('input'));
    el.querySelector<HTMLFormElement>('form.code')!.dispatchEvent(new Event('submit'));
    await settle();
    expect(auth.verifyCode).toHaveBeenCalledOnceWith('riya@example.com', '123456');
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/create');
  });

  it('goes back to the form with "Use a different email"', async () => {
    render('/create');
    sendTo('riya@example.com');
    await settle();
    fixture.detectChanges();
    [...el.querySelectorAll<HTMLButtonElement>('.link')].find((b) => b.textContent!.includes('different email'))!.click();
    fixture.detectChanges();
    expect(el.querySelector('.sent')).toBeNull();
    expect(el.querySelector<HTMLInputElement>('input[type=email]')!.value).toBe('riya@example.com');
  });

  it('sends a signed-in couple straight on to next', () => {
    auth.user.set({ id: 'u1', email: 'riya@example.com' });
    render('/create');
    TestBed.tick();
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/create');
  });

  it('sends a signed-in couple without a next param to their account page', () => {
    auth.user.set({ id: 'u1', email: 'riya@example.com' });
    render();
    TestBed.tick();
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/account');
    expect(el.textContent).not.toContain('Namaste');
  });

  it('asks the magic link to come back to the account page when there is no next', async () => {
    render();
    sendTo('riya@example.com');
    await settle();
    expect(auth.sendMagicLink).toHaveBeenCalledOnceWith('riya@example.com', '/account');
  });

  it('never sends the link back to an unsafe next', async () => {
    render('//evil.example');
    sendTo('riya@example.com');
    await settle();
    expect(auth.sendMagicLink).toHaveBeenCalledOnceWith('riya@example.com', '/account');
  });
});

describe('LoginPage in demo mode', () => {
  it('signs in to a local demo account at once, without the "check your email" step', async () => {
    const { DemoAuthService } = await import('../../core/auth/auth.service');
    localStorage.removeItem('sg.demoUser');
    TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [provideZonelessChangeDetection(), provideRouter([]), { provide: AuthService, useClass: DemoAuthService }],
    });
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    const fixture = TestBed.createComponent(LoginPage);
    fixture.componentRef.setInput('next', '/create');
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.demo-hint')!.textContent).toContain('no email is sent');
    expect(el.querySelector('button[type=submit]')!.textContent).toContain('Sign in to the demo');
    const input = el.querySelector<HTMLInputElement>('input[type=email]')!;
    input.value = 'Konica@Example.com';
    input.dispatchEvent(new Event('input'));
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    for (let i = 0; i < 10; i++) await Promise.resolve();
    TestBed.tick();
    fixture.detectChanges();
    expect(TestBed.inject(AuthService).user()?.email).toBe('konica@example.com');
    expect(el.querySelector('.sent')).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/create');
    fixture.destroy();
    localStorage.removeItem('sg.demoUser');
  });
});

describe('login helpers', () => {
  it('names the purpose of each protected page', () => {
    expect(purposeFor('/create')).toBe('create your wedding page');
    expect(purposeFor('/w/a-b/dashboard')).toBe('open your dashboard');
    expect(purposeFor('/w/a-b/invite?template=royal')).toBe('design your invite');
    expect(purposeFor('/w/a-b/guests')).toBe('manage your guest list');
    expect(purposeFor(undefined)).toBe('manage your wedding pages');
  });

  it('only follows in-app next paths', () => {
    expect(safeNext('/create')).toBe('/create');
    expect(safeNext('//evil.example')).toBe('');
    expect(safeNext('https://evil.example')).toBe('');
    expect(safeNext('/login?next=/create')).toBe('');
  });

  it('formats the countdown', () => {
    expect(clock(60)).toBe('1:00');
    expect(clock(59)).toBe('0:59');
    expect(clock(5)).toBe('0:05');
    expect(clock(0)).toBe('0:00');
  });
});
