import { GUEST_STATUS, INVITE_LANGUAGES, MAX_PARTY, MAX_UPI_AMOUNT, isCounted } from '../models';
import { guestStatus } from '../guests';
import {
  DEMO_ID, DEMO_IDS, DEMO_SAMPLES, DEMO_SLUG, DEMO_SLUGS, demoContributions, demoGuests, demoRsvps, demoWedding, demoWeddings, isDemoId, isDemoSlug,
} from './seed';

describe('demo seed', () => {
  const now = new Date(2026, 10, 16, 12);
  const weddings = demoWeddings(now);
  const FAKE_PHONE = /^9190000\d{5}$/;

  it('has three fictional sample weddings, Riya & Arjun first', () => {
    expect(weddings.length).toBe(3);
    expect(weddings[0].slug).toBe(DEMO_SLUG);
    expect(weddings[0].id).toBe(DEMO_ID);
    expect(weddings.map((w) => w.slug)).toEqual([...DEMO_SLUGS]);
    expect(weddings.map((w) => w.id)).toEqual([...DEMO_IDS]);
    expect(DEMO_SAMPLES.length).toBe(3);
    expect(weddings.every((w) => w.demo)).toBeTrue();
    expect(demoWedding(now)).toEqual(weddings[0]);
    expect(weddings.map((w) => w.city)).toEqual(['Udaipur', 'Ahmedabad', 'Bengaluru']);
  });

  it('gives each sample a different style and language', () => {
    expect(weddings.map((w) => w.invite!.template)).toEqual(['rajasthani', 'gujarati', 'south']);
    expect(weddings.map((w) => w.invite!.language)).toEqual(['english', 'gujarati', 'english']);
    expect(new Set(weddings.map((w) => w.cover.preset)).size).toBe(3);
  });

  it('recognises the sample ids and slugs only', () => {
    for (const w of weddings) {
      expect(isDemoId(w.id)).toBeTrue();
      expect(isDemoSlug(w.slug)).toBeTrue();
    }
    expect(isDemoId('w1')).toBeFalse();
    expect(isDemoId(undefined)).toBeFalse();
    expect(isDemoSlug('riya-weds-arjun-2')).toBeFalse();
    expect(isDemoSlug(null)).toBeFalse();
  });

  for (const w of weddings) {
    describe(w.slug, () => {
      const guests = demoGuests(w, now.getTime());
      const gifts = demoContributions(w, now.getTime());
      const rsvps = demoRsvps(w, now.getTime());
      const eventIds = new Set((w.events ?? []).map((e) => e.id));

      it('is a full page: families, 4–6 functions, 2–5 dreams, gallery, story and invite names', () => {
        expect(w.families?.bride).toBeTruthy();
        expect(w.families?.groom).toBeTruthy();
        expect(w.events!.length).toBeGreaterThanOrEqual(4);
        expect(w.events!.length).toBeLessThanOrEqual(6);
        expect(w.goals.length).toBeGreaterThanOrEqual(2);
        expect(w.goals.length).toBeLessThanOrEqual(5);
        expect(w.goals.every((g) => g.target > 0)).toBeTrue();
        expect(w.gallery!.length).toBeGreaterThanOrEqual(2);
        expect(w.milestones!.length).toBeGreaterThanOrEqual(3);
        expect(w.story.length).toBeGreaterThan(100);
        expect(w.invite!.grandparents.bride).toBeTruthy();
        expect(w.invite!.swagatotsuk).toBeTruthy();
        expect(w.invite!.darshanabhilashi).toBeTruthy();
        expect(new Date(w.date).getTime()).toBeGreaterThan(now.getTime() + 14 * 86_400_000);
        expect(new Date(w.date).getTime()).toBeLessThan(now.getTime() + 60 * 86_400_000);
      });

      it('uses a fake UPI ID', () => {
        expect(w.upiId).toMatch(/@demo$/);
      });

      it('has 40–80 guests at every tracking stage, in several languages and groups', () => {
        expect(guests.length).toBeGreaterThanOrEqual(40);
        expect(guests.length).toBeLessThanOrEqual(80);
        const stages = new Set(guests.map((g) => guestStatus(g)));
        for (const s of GUEST_STATUS) expect(stages.has(s.id)).withContext(s.id).toBeTrue();
        expect(new Set(guests.map((g) => g.language).filter(Boolean)).size).toBeGreaterThanOrEqual(3);
        expect(guests.filter((g) => g.language).length).toBeGreaterThan(guests.length / 2);
        expect(new Set(guests.map((g) => g.group)).size).toBeGreaterThanOrEqual(5);
        expect(new Set(guests.map((g) => g.side))).toEqual(new Set(['bride', 'groom']));
        expect(guests.every((g) => g.weddingId === w.id)).toBeTrue();
        expect(guests.every((g) => /^[A-Za-z0-9]{8,24}$/.test(g.token))).toBeTrue();
        for (const g of guests) {
          for (const t of [g.sentAt, g.openedAt, g.rsvpAt, g.gaveAt]) if (t) expect(t).toBeLessThan(now.getTime());
        }
      });

      it('has 20–40 blessings: verified, guest-confirmed and paid by Razorpay, some without a message', () => {
        expect(gifts.length).toBeGreaterThanOrEqual(20);
        expect(gifts.length).toBeLessThanOrEqual(40);
        const statuses = new Set(gifts.map((c) => c.status));
        expect(statuses).toEqual(new Set(['verified', 'guest-confirmed', 'paid']));
        expect(gifts.every(isCounted)).toBeTrue();
        expect(gifts.filter((c) => !c.message).length).toBeGreaterThanOrEqual(2);
        expect(gifts.some((c) => c.thankedAt)).toBeTrue();
        const goalIds = new Set(w.goals.map((g) => g.id));
        for (const c of gifts) {
          expect(goalIds.has(c.goalId)).withContext(c.id).toBeTrue();
          expect(c.amount).toBeGreaterThan(0);
          expect(c.amount).toBeLessThanOrEqual(MAX_UPI_AMOUNT);
          expect(c.createdAt).toBeLessThan(now.getTime());
          expect(c.createdAt).toBeGreaterThan(w.createdAt);
          if (c.thankedAt) expect(c.thankedAt).toBeLessThan(now.getTime());
        }
        for (const c of gifts.filter((x) => x.status === 'paid')) {
          expect(c.provider).toBe('razorpay');
          expect(c.razorpayOrderId).toMatch(/^order_DEMO[A-Z0-9]+$/);
          expect(c.razorpayPaymentId).toMatch(/^pay_DEMO[A-Z0-9]+$/);
          expect(c.chargedAmount!).toBeCloseTo(c.amount + (c.guestFee ?? 0), 2);
          expect(c.fee).toBeGreaterThan(0);
          expect(c.paidAt).toBeDefined();
        }
      });

      it('has RSVPs for real functions with realistic party sizes', () => {
        expect(rsvps.length).toBeGreaterThanOrEqual(15);
        for (const r of rsvps) {
          expect(r.eventIds.length).withContext(r.guestName).toBeGreaterThan(0);
          expect(r.eventIds.every((id) => eventIds.has(id))).withContext(r.guestName).toBeTrue();
          expect(r.partySize).toBeGreaterThanOrEqual(1);
          expect(r.partySize).toBeLessThanOrEqual(Math.min(8, MAX_PARTY));
        }
        // Every function has guests coming.
        for (const id of eventIds) expect(rsvps.some((r) => r.eventIds.includes(id))).withContext(id).toBeTrue();
        expect(rsvps.some((r) => r.partySize >= 7)).toBeTrue();
      });

      it('only uses clearly fake phone numbers', () => {
        const phones = [...guests.map((g) => g.phone), ...gifts.map((c) => c.phone), ...rsvps.map((r) => r.phone)].filter((p): p is string => !!p);
        expect(phones.length).toBeGreaterThan(30);
        for (const p of phones) expect(p).toMatch(FAKE_PHONE);
        expect(guests.some((g) => !g.phone)).toBeTrue();
      });
    });
  }

  it('keeps ids and personal-link tokens unique across all samples', () => {
    const all = weddings.map((w) => ({ g: demoGuests(w, now.getTime()), c: demoContributions(w, now.getTime()), r: demoRsvps(w, now.getTime()) }));
    const tokens = all.flatMap((x) => x.g.map((g) => g.token));
    expect(new Set(tokens).size).toBe(tokens.length);
    const ids = all.flatMap((x) => [...x.g, ...x.c, ...x.r].map((o) => o.id));
    expect(new Set(ids).size).toBe(ids.length);
    const phones = all.flatMap((x) => x.g.map((g) => g.phone).filter(Boolean));
    expect(new Set(phones).size).toBe(phones.length);
  });

  it('keeps the showcase ids that links and tests rely on', () => {
    const w = weddings[0];
    expect(w.events!.map((e) => e.id)).toEqual(['e-haldi', 'e-mehndi', 'e-sangeet', 'e-wedding', 'e-reception']);
    expect(w.goals.map((g) => g.id)).toEqual(['g-honeymoon', 'g-home', 'g-kyoto', 'g-trees']);
    expect(w.goals[0].updates![0].text).toContain('Flights booked');
    expect(demoGuests(w, now.getTime())[0].token).toBe('demo0001tk');
  });

  it('writes blessings in English, Hindi, Gujarati and Hinglish', () => {
    const messages = weddings.flatMap((w) => demoContributions(w, now.getTime()).map((c) => c.message));
    expect(messages.some((m) => /[ऀ-ॿ]/.test(m))).withContext('Devanagari').toBeTrue();
    expect(messages.some((m) => /[઀-૿]/.test(m))).withContext('Gujarati').toBeTrue();
    expect(messages.some((m) => /\b(shaadi|mubarak|khush|bhai)\b/i.test(m))).withContext('Hinglish').toBeTrue();
    expect(messages.some((m) => /\bcongratulations\b/i.test(m))).withContext('English').toBeTrue();
    expect(INVITE_LANGUAGES.every((l) => weddings.some((w) => demoGuests(w).some((g) => g.language === l.id)))).toBeTrue();
  });

  it('is deterministic', () => {
    const t = now.getTime();
    expect(demoGuests(weddings[1], t)).toEqual(demoGuests(demoWeddings(now)[1], t));
    expect(demoContributions(weddings[2], t)).toEqual(demoContributions(demoWeddings(now)[2], t));
  });
});
