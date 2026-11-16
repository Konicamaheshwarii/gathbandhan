import { contributionsCsv, csvCell } from './csv';
import { contribution, wedding } from './testing';

describe('CSV export', () => {
  it('quotes commas, quotes and new lines', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('Rao, Asha')).toBe('"Rao, Asha"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell(undefined)).toBe('');
  });

  it('neutralises spreadsheet formulas typed by guests', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+91 98765')).toBe("'+91 98765");
    expect(csvCell('@sum')).toBe("'@sum");
  });

  it('writes one row per contribution, oldest first, with a BOM for Excel', () => {
    const csv = contributionsCsv(wedding(), [
      contribution('g2', 1100, { guestName: 'Zoya', createdAt: new Date(2026, 10, 2).getTime(), message: 'जुग जुग जियो' }),
      contribution('g1', 2100, { guestName: 'Kabir', createdAt: new Date(2026, 10, 1).getTime(), status: 'verified', thankedAt: 5, side: 'groom' }),
      contribution('old', 501, { guestName: 'Ravi', createdAt: new Date(2026, 10, 3).getTime() }),
    ]);
    expect(csv.startsWith('﻿')).toBeTrue();
    const rows = csv.slice(1).trim().split('\r\n');
    expect(rows[0]).toBe('Date,Guest,Side,Goal,Amount (INR),Status,Paid via,Payment ID,Order ID,Guest paid (INR),Fees (INR),Message,Phone,Thanked');
    expect(rows[1]).toBe("01/11/2026,Kabir,Groom's side,Honeymoon,2100,Verified,UPI direct,,,2100,0.00,,,Yes");
    expect(rows[2]).toBe('02/11/2026,Zoya,,Trees,1100,Guest confirmed,UPI direct,,,1100,0.00,जुग जुग जियो,,No');
    expect(rows[3]).toContain('(removed goal)');
  });

  it('includes Razorpay payment ids, what the guest paid and the fees', () => {
    const csv = contributionsCsv(wedding(), [
      contribution('g1', 2100, {
        guestName: 'Meera', createdAt: new Date(2026, 10, 4).getTime(), status: 'paid', provider: 'razorpay',
        razorpayOrderId: 'order_Test12345', razorpayPaymentId: 'pay_Test67890', chargedAmount: 2150.75, guestFee: 50.75, fee: 50.75,
      }),
    ]);
    const row = csv.slice(1).trim().split('\r\n')[1];
    expect(row).toBe('04/11/2026,Meera,,Honeymoon,2100,Paid (Razorpay),Razorpay,pay_Test67890,order_Test12345,2150.75,50.75,,,No');
  });
});
