import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { KEYS, LocalStorageWeddingRepository } from '../../core/data/local-storage.repository';
import { WeddingRepository } from '../../core/data/wedding.repository';
import { wedding } from '../../core/testing';
import { parseUpiLink } from '../../core/upi';
import { GivePage } from './give.page';

describe('GivePage', () => {
  let fixture: ComponentFixture<GivePage>;
  let repo: LocalStorageWeddingRepository;
  let el: HTMLElement;

  const button = (text: string) =>
    [...el.querySelectorAll<HTMLElement>('button, a')].find((b) => b.textContent!.includes(text))!;
  const type = (selector: string, value: string) => {
    const input = el.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  /** Lets repository promises resolve and change detection catch up. */
  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 0));
      await fixture.whenStable();
      fixture.detectChanges();
    }
  };

  beforeEach(async () => {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    await TestBed.configureTestingModule({
      imports: [GivePage],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: WeddingRepository, useClass: LocalStorageWeddingRepository },
      ],
    }).compileComponents();
    repo = TestBed.inject(WeddingRepository) as LocalStorageWeddingRepository;
    await repo.saveWedding(wedding());
    fixture = TestBed.createComponent(GivePage);
    fixture.componentRef.setInput('slug', 'asha-weds-dev');
    fixture.componentRef.setInput('goal', 'g2');
    el = fixture.nativeElement;
    await settle();
    await settle();
  });

  afterEach(() => Object.values(KEYS).forEach((k) => localStorage.removeItem(k)));

  it('preselects the goal from the link and offers shagun amounts', () => {
    const checked = el.querySelector('.goal-option[aria-checked="true"]')!;
    expect(checked.textContent).toContain('Trees');
    expect([...el.querySelectorAll('.amount-chip')].map((c) => c.textContent!.trim())).toEqual(['₹501', '₹1,100', '₹2,100', '₹5,100']);
  });

  it('blocks payment until the guest gives a name and a valid amount', async () => {
    type('.amount-input input', '150000');
    button('Continue to pay').click();
    await settle();
    expect(el.textContent).toContain('UPI allows up to ₹1,00,000');
    expect(el.textContent).toContain('Tell the couple who this blessing is from');
    expect(el.querySelector('app-qr-code')).toBeNull();
  });

  it('walks a guest from amount to UPI to a recorded blessing', async () => {
    button('₹1,100').click();
    type('input[autocomplete=name]', 'Pooja Bua');
    type('textarea', 'Khoob ghoomo!');
    await settle();
    button('Continue to pay').click();
    await settle();

    expect(el.querySelector('app-qr-code svg path')).not.toBeNull();
    const link = el.querySelector<HTMLAnchorElement>('a.marigold')?.getAttribute('href') ?? (fixture.componentInstance as any)['upiLink']();
    expect(parseUpiLink(link)).toEqual(jasmine.objectContaining({ pa: 'asha.dev@okaxis', am: '1100.00', cu: 'INR' }));

    button("I've paid").click();
    await settle();
    await settle();
    expect(el.textContent).toContain('Dhanyavaad, Pooja!');
    const saved = await repo.listContributions('w1');
    expect(saved.length).toBe(1);
    expect(saved[0]).toEqual(jasmine.objectContaining({ goalId: 'g2', amount: 1100, guestName: 'Pooja Bua', message: 'Khoob ghoomo!', status: 'guest-confirmed' }));
  });
});
