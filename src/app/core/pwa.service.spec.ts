import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PwaService, isIosDevice } from './pwa.service';

describe('PwaService', () => {
  let pwa: PwaService;

  beforeEach(() => {
    localStorage.removeItem('sg.installDismissed');
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    pwa = TestBed.inject(PwaService);
  });

  afterEach(() => localStorage.removeItem('sg.installDismissed'));

  it('recognises iPhones and iPads (which report themselves as Macs)', () => {
    expect(isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBeTrue();
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBeTrue();
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBeFalse();
    expect(isIosDevice('Mozilla/5.0 (Linux; Android 15)', 5)).toBeFalse();
  });

  it('offers the install button after the browser allows it, and installs on tap', async () => {
    const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: jasmine.Spy; userChoice: Promise<unknown> };
    event.prompt = jasmine.createSpy('prompt').and.resolveTo();
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    dispatchEvent(event);
    expect(event.defaultPrevented).toBeTrue();
    expect(pwa.canPrompt()).toBeTrue();
    expect(pwa.offerInstall()).toBe(!pwa.standalone());
    await pwa.install();
    expect(event.prompt).toHaveBeenCalled();
    expect(pwa.canPrompt()).toBeFalse();
  });

  it('remembers "not now" and hides once installed', () => {
    dispatchEvent(new Event('beforeinstallprompt'));
    pwa.dismiss();
    expect(pwa.offerInstall()).toBeFalse();
    expect(localStorage.getItem('sg.installDismissed')).toBe('true');
    dispatchEvent(new Event('appinstalled'));
    expect(pwa.standalone()).toBeTrue();
  });

  it('follows online and offline events', () => {
    dispatchEvent(new Event('offline'));
    expect(pwa.online()).toBeFalse();
    dispatchEvent(new Event('online'));
    expect(pwa.online()).toBeTrue();
  });
});
