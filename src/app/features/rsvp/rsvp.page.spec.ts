import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { KEYS, LocalStorageWeddingRepository } from '../../core/data/local-storage.repository';
import { WeddingRepository } from '../../core/data/wedding.repository';
import { wedding } from '../../core/testing';
import { RsvpPage } from './rsvp.page';

describe('RsvpPage', () => {
  let fixture: ComponentFixture<RsvpPage>;
  let repo: LocalStorageWeddingRepository;
  let el: HTMLElement;

  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 0));
      await fixture.whenStable();
      fixture.detectChanges();
    }
  };
  const button = (text: string) => [...el.querySelectorAll<HTMLElement>('button')].find((b) => b.textContent!.includes(text))!;

  beforeEach(async () => {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    await TestBed.configureTestingModule({
      imports: [RsvpPage],
      providers: [provideZonelessChangeDetection(), provideRouter([]), { provide: WeddingRepository, useClass: LocalStorageWeddingRepository }],
    }).compileComponents();
    repo = TestBed.inject(WeddingRepository) as LocalStorageWeddingRepository;
    await repo.saveWedding(wedding({
      events: [
        { id: 'e1', kind: 'sangeet', name: 'Sangeet', date: '2026-12-11', time: '19:30', venue: 'Durbar Hall' },
        { id: 'e2', kind: 'wedding', name: 'Wedding', date: '2026-12-12', time: '18:00', venue: 'Taj' },
      ],
    }));
    fixture = TestBed.createComponent(RsvpPage);
    fixture.componentRef.setInput('slug', 'asha-weds-dev');
    el = fixture.nativeElement;
    await settle();
    await settle();
  });

  afterEach(() => Object.values(KEYS).forEach((k) => localStorage.removeItem(k)));

  it('starts with every function ticked and asks for a name', async () => {
    expect(el.querySelectorAll('input[type=checkbox]:checked').length).toBe(2);
    button('Send RSVP').click();
    await settle();
    expect(el.textContent).toContain('Tell the couple who is replying');
    expect(await repo.listRsvps('w1')).toEqual([]);
  });

  it('records the functions, party size and side', async () => {
    const name = el.querySelector<HTMLInputElement>('input[autocomplete=name]')!;
    name.value = 'Sharma Parivar';
    name.dispatchEvent(new Event('input'));
    el.querySelectorAll<HTMLInputElement>('input[type=checkbox]')[0].click();
    el.querySelector<HTMLElement>('[aria-label="One more"]')!.click();
    el.querySelector<HTMLElement>('[aria-label="One more"]')!.click();
    button("Groom's side").click();
    await settle();
    button('Send RSVP').click();
    await settle();
    await settle();
    expect(el.textContent).toContain('See you there, Sharma!');
    const [r] = await repo.listRsvps('w1');
    expect(r).toEqual(jasmine.objectContaining({ guestName: 'Sharma Parivar', eventIds: ['e2'], partySize: 3, side: 'groom' }));
  });
});
