import { Guest, Rsvp } from './models';
import { activityFeed, cumulativeByDay, inviteStats, splitBySide, weddingChecklist } from './stats';
import { contribution, wedding } from './testing';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

describe('dashboard stats', () => {
  it('builds a running total per day, counting older money at the start', () => {
    const list = [
      contribution('g1', 1000, { createdAt: at(2026, 10, 1) }),
      contribution('g1', 500, { createdAt: at(2026, 11, 13, 9) }),
      contribution('g1', 250, { createdAt: at(2026, 11, 13, 20) }),
      contribution('g1', 100, { createdAt: at(2026, 11, 14, 8) }),
    ];
    const days = cumulativeByDay(list, 3, at(2026, 11, 14, 18));
    expect(days.length).toBe(3);
    expect(days.map((d) => [new Date(d.day).getDate(), d.amount, d.total])).toEqual([[12, 0, 1000], [13, 750, 1750], [14, 100, 1850]]);
  });

  it('splits shagun by family side', () => {
    const s = splitBySide([contribution('g1', 3000, { side: 'bride' }), contribution('g1', 1000, { side: 'groom' }), contribution('g1', 1000)]);
    expect(s).toEqual([
      { side: 'bride', amount: 3000, count: 1, percent: 60 },
      { side: 'groom', amount: 1000, count: 1, percent: 20 },
      { side: 'none', amount: 1000, count: 1, percent: 20 },
    ]);
  });

  const guest = (patch: Partial<Guest>): Guest => ({ id: Math.random().toString(), weddingId: 'w1', name: 'G', token: 'abcdefgh23', createdAt: 1, ...patch });

  it('counts the invite funnel cumulatively', () => {
    const s = inviteStats([guest({}), guest({ sentAt: 1 }), guest({ sentAt: 1, openedAt: 2 }), guest({ openedAt: 2, rsvpAt: 3 }), guest({ gaveAt: 4 })]);
    expect(s).toEqual({ total: 5, sent: 4, opened: 3, rsvp: 2, gave: 1 });
  });

  it('merges shagun, RSVPs and invite opens into one feed, newest first', () => {
    const rsvp: Rsvp = { id: 'r', weddingId: 'w1', guestName: 'Sharma Parivar', eventIds: ['e'], partySize: 4, note: '', createdAt: 30 };
    const feed = activityFeed(wedding(), [contribution('g1', 2100, { guestName: 'Kabir', createdAt: 20 })], [rsvp], [guest({ name: 'Gupta', openedAt: 40 })]);
    expect(feed.map((f) => f.kind)).toEqual(['opened', 'rsvp', 'shagun']);
    expect(feed[1].text).toBe('is coming with 3 more');
    expect(feed[2].text).toBe('gave ₹2,100 towards Honeymoon');
  });

  it('derives the wedding checklist', () => {
    const w = wedding({ events: [{ id: 'e', kind: 'wedding', name: 'Wedding', date: '2026-12-12', time: '18:00', venue: 'Taj' }] });
    const items = weddingChecklist(w, [contribution('g1', 100, { status: 'verified', thankedAt: 1 })], [], [guest({ sentAt: 1 })], false);
    const done = Object.fromEntries(items.map((i) => [i.id, i.done]));
    expect(done).toEqual({ page: true, functions: true, invite: false, sent: true, card: false, rsvps: false, verify: true, thanks: true });
  });
});
