import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TEMPLATES, defaultInvite, invitePages } from '../../core/invite';
import { InviteLanguage, InviteTemplate } from '../../core/models';
import { wedding } from '../../core/testing';
import { cuspedArch, gopuramTiers } from './invite-art';
import { InvitePageComponent } from './invite-page.component';

describe('InvitePageComponent', () => {
  const w = wedding({
    families: { bride: 'Mrs. & Mr. Rao', groom: 'Mrs. & Mr. Khanna' },
    events: [{ id: 'e1', kind: 'wedding', name: 'Wedding', date: '2026-12-12', time: '18:00', venue: 'Taj Lands End' }],
  });

  beforeEach(() => TestBed.configureTestingModule({ imports: [InvitePageComponent], providers: [provideZonelessChangeDetection()] }));

  function render(template: InviteTemplate, kind: 'cover' | 'final' | 'invitation', language: InviteLanguage = 'english', coverPhoto = '') {
    const fixture = TestBed.createComponent(InvitePageComponent);
    const design = { ...defaultInvite(w, template, language), coverPhoto };
    const page = invitePages(w, design).find((p) => p.kind === kind)!;
    fixture.componentRef.setInput('wedding', w);
    fixture.componentRef.setInput('design', design);
    fixture.componentRef.setInput('page', page);
    fixture.componentRef.setInput('rsvpUrl', 'https://example.test/rsvp');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('draws every style with its own artwork, layout class and the couple on the cover', () => {
    const shapes = new Set<string>();
    for (const t of TEMPLATES) {
      const el = render(t.id, 'cover');
      const page = el.querySelector('article')!;
      expect(page.classList).withContext(t.id).toContain(`tpl-${t.id}`);
      expect(el.querySelector('.names')!.textContent).withContext(t.id).toContain('Asha');
      expect(el.querySelector('.names')!.textContent).withContext(t.id).toContain('Dev');
      const art = el.querySelector('app-invite-art svg');
      expect(art).withContext(t.id).not.toBeNull();
      // A rough fingerprint of the artwork: no two styles share the same drawing.
      shapes.add([...art!.querySelectorAll('*')].map((n) => n.tagName).join(','));
    }
    expect(shapes.size).toBe(TEMPLATES.length);
  });

  it('renders the inner pages in each style, with the RSVP code on the last page', () => {
    for (const t of TEMPLATES) {
      const final = render(t.id, 'final');
      expect(final.querySelector('.qrs app-qr-code')).withContext(t.id).not.toBeNull();
      const inv = render(t.id, 'invitation');
      expect(inv.querySelector('.body')!.textContent).withContext(t.id).toContain('Asha');
    }
  });

  it('honours the colour override in the artwork', () => {
    const fixture = TestBed.createComponent(InvitePageComponent);
    const design = { ...defaultInvite(w, 'ganesh'), palette: { primary: '#123456', accent: '#654321', paper: '#ffffff' } };
    fixture.componentRef.setInput('wedding', w);
    fixture.componentRef.setInput('design', design);
    fixture.componentRef.setInput('page', { kind: 'cover' });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-invite-art rect[stroke="#123456"]')).not.toBeNull();
    expect((el.querySelector('app-invite-page, :host') ?? el).outerHTML).toContain('--i-primary: #123456');
  });

  it('puts the photo on the covers that use one, and art when there is none', () => {
    expect(render('photo', 'cover', 'english', 'p.jpg').querySelector('.poster img')).not.toBeNull();
    expect(render('photo', 'cover').querySelector('.poster app-invite-art')).not.toBeNull();
    expect(render('rajasthani', 'cover', 'english', 'p.jpg').querySelector('.window img')).not.toBeNull();
    expect(render('royal', 'cover', 'english', 'p.jpg').querySelector('img')).toBeNull();
  });

  it('marks the language for Hindi and Gujarati', () => {
    expect(render('mehndi', 'cover', 'hindi').querySelector('article')!.getAttribute('lang')).toBe('hi');
    expect(render('gujarati', 'cover', 'gujarati').querySelector('.title')!.textContent).toContain('શુભ લગ્ન');
  });
});

describe('invite art geometry', () => {
  it('draws a closed cusped arch with one arc per lobe', () => {
    const d = cuspedArch(100, 800, 500, 150, 1600, 9);
    expect(d.startsWith('M100 1600 L100 500')).toBeTrue();
    expect(d.endsWith('L800 1600 Z')).toBeTrue();
    expect(d.match(/A/g)!.length).toBe(9);
  });

  it('narrows the gopuram as it rises', () => {
    const tiers = gopuramTiers(450, 470, 360, 330);
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i][1] - tiers[i][0]).toBeLessThan(tiers[i - 1][1] - tiers[i - 1][0]);
      expect(tiers[i][3]).toBeCloseTo(tiers[i - 1][2]);
    }
  });
});
