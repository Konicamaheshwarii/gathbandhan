import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AiService } from '../../core/ai/ai.service';
import { Guest, WeddingEvent } from '../../core/models';
import { wedding } from '../../core/testing';
import { hasBrokenCharacters } from '../../core/text';
import { appBaseUrl } from '../../core/wedding-link';
import { InviteComposerComponent } from './invite-composer.component';
import { InviteMessageState, messageChoiceKey } from './invite-message.state';

const W = wedding({
  id: 'w-msg', slug: 'john-weds-jenny', partner1: 'john', partner2: 'jenny', city: 'UDaipur',
  events: [{ id: 'e1', kind: 'haldi', name: '', date: '2027-02-15', time: '10:00', venue: 'Ghat' } as WeddingEvent],
});
const guest = (patch: Partial<Guest>): Guest => ({ id: 'g1', weddingId: 'w-msg', name: 'konica', token: 'CzHh2wxDcB', phone: '919876543210', createdAt: 1, ...patch });

describe('InviteComposerComponent (WhatsApp preview)', () => {
  let fixture: ComponentFixture<InviteComposerComponent>;
  let el: HTMLElement;
  let state: InviteMessageState;
  let ai: jasmine.SpyObj<AiService>;

  function render(guests: Guest[] = [guest({})]) {
    ai = jasmine.createSpyObj<AiService>('ai', ['whatsappMessage']);
    TestBed.configureTestingModule({
      imports: [InviteComposerComponent],
      providers: [provideZonelessChangeDetection(), InviteMessageState, { provide: AiService, useValue: ai }],
    });
    state = TestBed.inject(InviteMessageState);
    state.init(W, 'english');
    fixture = TestBed.createComponent(InviteComposerComponent);
    fixture.componentRef.setInput('wedding', W);
    fixture.componentRef.setInput('guests', guests);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }
  const bubble = () => el.querySelector('[data-test=wa-preview]')!;
  const pick = (attr: string, value: string) => {
    el.querySelector<HTMLButtonElement>(`[data-${attr}="${value}"]`)!.click();
    fixture.detectChanges();
  };

  beforeEach(() => localStorage.removeItem(messageChoiceKey('w-msg')));
  afterEach(() => localStorage.removeItem(messageChoiceKey('w-msg')));

  it('labels each language in its own script and rewrites the preview at once', () => {
    render();
    const labels = [...el.querySelectorAll('.langs button')].map((b) => b.textContent!.trim());
    expect(labels).toEqual(['English', 'हिन्दी', 'ગુજરાતી', 'Hinglish']);
    expect(bubble().textContent).toContain('Dear Konica,');
    expect(bubble().querySelector('strong')!.textContent).toBe('John & Jenny');

    pick('lang', 'hindi');
    expect(bubble().textContent).toContain('॥ श्री गणेशाय नमः ॥');
    expect(bubble().textContent).toContain('आदरणीय Konica ji,');
    expect(bubble().textContent).toContain('हल्दी');
    pick('lang', 'gujarati');
    expect(bubble().textContent).toContain('આદરણીય Konica ji,');
    pick('tone', 'modern');
    expect(bubble().textContent).toContain('💍');
  });

  it('remembers the language and tone per wedding', () => {
    render();
    pick('lang', 'hindi');
    pick('tone', 'fun');
    const fresh = new InviteMessageState();
    fresh.init(W, 'english');
    expect(fresh.language()).toBe('hindi');
    expect(fresh.tone()).toBe('fun');
  });

  it('leaves the shagun link out unless asked', () => {
    render();
    expect(bubble().textContent).not.toContain('#/w/john-weds-jenny/give');
    const box = el.querySelector<HTMLInputElement>('[data-test=include-shagun]')!;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(bubble().textContent).toContain('🎁 Shagun:');
    expect(bubble().textContent).toContain('#/w/john-weds-jenny/give');
  });

  it('opens WhatsApp with clean text and the personal links', () => {
    render();
    const href = el.querySelector<HTMLAnchorElement>('[data-test=open-whatsapp]')!.href;
    expect(href.startsWith('https://api.whatsapp.com/send?phone=919876543210&text=')).toBeTrue();
    const text = new URL(href).searchParams.get('text')!;
    expect(hasBrokenCharacters(text)).toBeFalse();
    expect(text).toContain(`${appBaseUrl()}#/i/john-weds-jenny/CzHh2wxDcB`);
    expect(text).toContain(`RSVP: ${appBaseUrl()}#/w/john-weds-jenny/rsvp`);
    expect(text).toContain('Udaipur');
  });

  it('notes when the previewed guest has their own language', () => {
    render([guest({ language: 'gujarati' })]);
    expect(el.querySelector('.own')!.textContent).toContain('ગુજરાતી');
    expect(state.message(guest({ language: 'gujarati' }))).toContain('આદરણીય');
  });

  it('rewrites with AI in the picked language, keeping the placeholders', async () => {
    render();
    pick('lang', 'hindi');
    ai.whatsappMessage.and.resolveTo({ value: 'नमस्ते {name}! शादी में ज़रूर आइए।\n📩 {link}\n✅ RSVP: {rsvp}', tier: 'demo' } as never);
    [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.includes('Rewrite with AI'))!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(ai.whatsappMessage.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ language: 'hindi', greeting: '{name}', url: '{link}', rsvpUrl: '{rsvp}' }));
    expect(bubble().textContent).toContain('नमस्ते Konica ji!');
  });
});

describe('appBaseUrl', () => {
  it('is the site address without index.html', () => {
    expect(appBaseUrl({ origin: 'https://konicamaheshwarii.github.io', pathname: '/gathbandhan/' })).toBe('https://konicamaheshwarii.github.io/gathbandhan/');
    expect(appBaseUrl({ origin: 'https://konicamaheshwarii.github.io', pathname: '/gathbandhan/index.html' })).toBe('https://konicamaheshwarii.github.io/gathbandhan/');
  });
});
