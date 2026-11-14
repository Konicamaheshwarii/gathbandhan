import { daysUntil, formatDate, formatDateLong, formatDateNumeric, formatInr, formatInrShort, groupIndian, parseAmount, timeAgo } from './format';

describe('Indian formatting', () => {
  it('groups rupees in lakhs and crores', () => {
    expect(formatInr(300000)).toBe('₹3,00,000');
    expect(formatInr(1000000)).toBe('₹10,00,000');
    expect(formatInr(12345678)).toBe('₹1,23,45,678');
    expect(formatInr(501)).toBe('₹501');
    expect(groupIndian(208001)).toBe('2,08,001');
  });

  it('rounds and tolerates missing values', () => {
    expect(formatInr(2100.6)).toBe('₹2,101');
    expect(formatInr(NaN)).toBe('₹0');
  });

  it('shortens to K, L and Cr', () => {
    expect(formatInrShort(300000)).toBe('₹3 L');
    expect(formatInrShort(420000)).toBe('₹4.2 L');
    expect(formatInrShort(1518000)).toBe('₹15.2 L');
    expect(formatInrShort(25000000)).toBe('₹2.5 Cr');
    expect(formatInrShort(97100)).toBe('₹97.1K');
    expect(formatInrShort(501)).toBe('₹501');
  });

  it('parses amounts typed with symbols and commas', () => {
    expect(parseAmount('2,100')).toBe(2100);
    expect(parseAmount('₹ 5,100')).toBe(5100);
    expect(parseAmount('Rs. 501')).toBe(501);
    expect(parseAmount('11.50')).toBe(11.5);
    expect(parseAmount('-500')).toBeNaN();
    expect(parseAmount('abc')).toBeNaN();
    expect(parseAmount('')).toBeNaN();
  });

  it('formats dates day-first', () => {
    expect(formatDate('2026-12-12')).toBe('12 Dec 2026');
    expect(formatDateLong('2026-12-12')).toBe('Saturday, 12 December 2026');
    expect(formatDate('2026-02-30')).toBe('2026-02-30');
    expect(formatDateNumeric(new Date(2026, 0, 5).getTime())).toBe('05/01/2026');
  });

  it('counts days to the wedding in local time', () => {
    const now = new Date(2026, 10, 14, 23, 30);
    expect(daysUntil('2026-11-14', now)).toBe(0);
    expect(daysUntil('2026-12-10', now)).toBe(26);
    expect(daysUntil('2026-11-01', now)).toBe(-13);
  });

  it('describes how long ago a blessing came in', () => {
    const now = Date.UTC(2026, 10, 14, 12);
    expect(timeAgo(now - 20_000, now)).toBe('just now');
    expect(timeAgo(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe('3 hrs ago');
    expect(timeAgo(now - 2 * 86_400_000, now)).toBe('2 days ago');
  });
});
