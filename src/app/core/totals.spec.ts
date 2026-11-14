import { contribution, wedding } from './testing';
import { computeTotals, expectedShagun, publicActivity, totalsFromActivity } from './totals';

describe('computeTotals', () => {
  it('sums each goal and the wedding, separating verified money', () => {
    const t = computeTotals(wedding(), [
      contribution('g1', 2100, { status: 'verified' }),
      contribution('g1', 5100),
      contribution('g2', 51000, { status: 'verified' }),
    ]);
    expect(t.raised).toBe(58200);
    expect(t.verified).toBe(53100);
    expect(t.target).toBe(350000);
    expect(t.percent).toBe(17);
    const [g1, g2] = t.goals;
    expect([g1.raised, g1.verified, g1.count, g1.percent, g1.funded]).toEqual([7200, 2100, 2, 2, false]);
    expect([g2.raised, g2.percent, g2.funded]).toEqual([51000, 100, true]);
  });

  it('caps percentages at 100 and counts a family once', () => {
    const t = computeTotals(wedding(), [
      contribution('g2', 40000, { guestName: 'Sunita Mausi' }),
      contribution('g2', 40000, { guestName: ' sunita mausi ' }),
    ]);
    expect(t.goals[1].percent).toBe(100);
    expect(t.contributors).toBe(1);
  });

  it('keeps money given to a removed goal in the total', () => {
    const t = computeTotals(wedding(), [contribution('gone', 1100)]);
    expect(t.raised).toBe(1100);
    expect(t.goals.every((g) => g.raised === 0)).toBeTrue();
  });

  it('handles an empty page', () => {
    const t = computeTotals(wedding({ goals: [] }), []);
    expect([t.raised, t.target, t.percent, t.contributors]).toEqual([0, 0, 0, 0]);
  });
});

describe('expectedShagun', () => {
  it('multiplies guests by the typical shagun', () => {
    expect(expectedShagun(200, 2000)).toBe(400000);
    expect(expectedShagun(-5, 2000)).toBe(0);
  });
});

describe('publicActivity', () => {
  const list = () => [
    contribution('g1', 2100, { guestName: 'Kabir', message: 'Enjoy!', phone: '919876543210', side: 'groom', createdAt: 5 }),
    contribution('g1', 5100, { guestName: 'Zoya', message: '', createdAt: 6 }),
    contribution('g2', 1100, { guestName: 'kabir ', message: 'Trees!', createdAt: 7 }),
  ];

  it('never exposes phone numbers, and hides amounts unless the couple shows them', () => {
    const hidden = publicActivity(wedding({ showAmounts: false }), list());
    expect(hidden.wall.map((e) => e.guestName)).toEqual(['kabir ', 'Kabir']);
    expect(hidden.wall.every((e) => !('amount' in e) && !('phone' in e))).toBeTrue();
    expect(hidden.wall[1].side).toBe('groom');
    const shown = publicActivity(wedding({ showAmounts: true }), list());
    expect(shown.wall[1].amount).toBe(2100);
  });

  it('gives the same totals guests and the couple see', () => {
    const w = wedding();
    const a = publicActivity(w, list());
    expect(a.goals).toEqual({ g1: { raised: 7200, count: 2 }, g2: { raised: 1100, count: 1 } });
    expect(a.contributors).toBe(2);
    const pub = totalsFromActivity(w, a);
    const full = computeTotals(w, list());
    expect(pub.raised).toBe(full.raised);
    expect(pub.percent).toBe(full.percent);
    expect(pub.goals.map((g) => g.percent)).toEqual(full.goals.map((g) => g.percent));
  });
});
