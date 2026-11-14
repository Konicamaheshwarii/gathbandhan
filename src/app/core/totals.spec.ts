import { contribution, wedding } from './testing';
import { computeTotals, expectedShagun } from './totals';

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
