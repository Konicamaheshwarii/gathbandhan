import { buildUpiLink, canOpenUpiApps, isValidVpa, parseUpiLink, upiAmount, upiNote } from './upi';

describe('UPI', () => {
  it('accepts real-world VPAs and rejects malformed ones', () => {
    for (const ok of ['riya.arjun@okhdfcbank', '9876543210@ybl', 'a_b-c@paytm', 'name@oksbi']) expect(isValidVpa(ok)).withContext(ok).toBeTrue();
    for (const bad of ['', 'riya', '@ybl', 'riya@', 'riya@@ybl', 'riya @ybl', 'riya@1bank', 'x@y']) expect(isValidVpa(bad)).withContext(bad).toBeFalse();
  });

  it('builds an intent link the UPI apps understand', () => {
    const link = buildUpiLink({ vpa: ' Riya.Arjun@OkHdfcBank ', payeeName: 'Riya Sharma', amount: 2100, note: 'Shagun for honeymoon' });
    expect(link).toBe('upi://pay?pa=riya.arjun@okhdfcbank&pn=Riya%20Sharma&am=2100.00&cu=INR&tn=Shagun%20for%20honeymoon');
  });

  it('keeps @ unescaped but encodes names and notes', () => {
    const link = buildUpiLink({ vpa: 'a@ybl', payeeName: 'R & A', amount: 501, note: 'From Kabir & Zoya' });
    expect(link).toContain('pa=a@ybl');
    expect(link).toContain('pn=R%20%26%20A');
    expect(parseUpiLink(link)).toEqual({ pa: 'a@ybl', pn: 'R & A', am: '501.00', cu: 'INR', tn: 'From Kabir & Zoya' });
  });

  it('omits the amount when none is given and falls back to the VPA as payee', () => {
    const fields = parseUpiLink(buildUpiLink({ vpa: 'a@ybl', payeeName: '  ' }));
    expect(fields['am']).toBeUndefined();
    expect(fields['pn']).toBe('a@ybl');
  });

  it('enforces the per-payment UPI limit', () => {
    expect(upiAmount(1)).toBe('1.00');
    expect(upiAmount(100000)).toBe('100000.00');
    expect(() => upiAmount(100001)).toThrowError(/₹1,00,000/);
    expect(() => upiAmount(0)).toThrow();
    expect(() => buildUpiLink({ vpa: 'not-a-vpa', payeeName: 'x', amount: 10 })).toThrowError(/UPI ID/);
  });

  it('cleans notes so strict apps accept them', () => {
    expect(upiNote('Shagun 🎉 #love <3')).toBe('Shagun love 3');
    const long = upiNote('Shagun for the honeymoon in Santorini and Amalfi from all of us');
    expect(long.length).toBeLessThanOrEqual(50);
    expect(long.endsWith('…')).toBeTrue();
  });

  it('detects phones that can open UPI apps', () => {
    expect(canOpenUpiApps('Mozilla/5.0 (Linux; Android 14) Mobile')).toBeTrue();
    expect(canOpenUpiApps('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBeTrue();
    expect(canOpenUpiApps('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBeFalse();
  });
});
