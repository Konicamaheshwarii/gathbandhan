import { contributionsCsv } from '../csv';
import { isConfirmed, isCounted } from '../models';
import { contribution, wedding } from '../testing';
import { computeTotals, publicActivity } from '../totals';

describe('totals with Razorpay payments', () => {
  const list = [
    contribution('g1', 1100, { status: 'guest-confirmed', message: 'UPI blessing' }),
    contribution('g1', 2100, { status: 'verified' }),
    contribution('g1', 5100, { status: 'paid', provider: 'razorpay', message: 'Paid blessing', razorpayPaymentId: 'pay_Abc1234567' }),
    contribution('g2', 9999, { status: 'pending', provider: 'razorpay', message: 'Still in checkout' }),
    contribution('g2', 7777, { status: 'failed', provider: 'razorpay', message: 'Card declined' }),
  ];

  it('never counts pending or failed attempts', () => {
    const t = computeTotals(wedding(), list);
    expect(t.raised).toBe(1100 + 2100 + 5100);
    expect(t.contributors).toBe(3);
    expect(t.goals.find((g) => g.goal.id === 'g2')!.raised).toBe(0);
  });

  it('treats Razorpay-paid shagun as confirmed money', () => {
    expect(computeTotals(wedding(), list).verified).toBe(2100 + 5100);
    expect(list.filter(isConfirmed).length).toBe(2);
    expect(list.filter(isCounted).length).toBe(3);
  });

  it('badges paid blessings on the public wall and hides attempts', () => {
    const a = publicActivity(wedding(), list);
    expect(a.raised).toBe(8300);
    expect(a.wall.map((e) => [e.message, !!e.paid])).toEqual(jasmine.arrayWithExactContents([
      ['UPI blessing', false],
      ['Paid blessing', true],
    ]));
  });

  it('labels Razorpay rows in the CSV', () => {
    const csv = contributionsCsv(wedding(), list.filter(isCounted));
    expect(csv).toContain('Paid (Razorpay),Razorpay,pay_Abc1234567');
  });
});
