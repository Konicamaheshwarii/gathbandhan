import { inviteMessage, normalizeIndianPhone, whatsappUrl } from './share';
import { wedding } from './testing';

describe('sharing', () => {
  it('normalises Indian mobile numbers for wa.me', () => {
    expect(normalizeIndianPhone('98765 43210')).toBe('919876543210');
    expect(normalizeIndianPhone('+91-98765-43210')).toBe('919876543210');
    expect(normalizeIndianPhone('09876543210')).toBe('919876543210');
    expect(normalizeIndianPhone('12345 67890')).toBeNull();
    expect(normalizeIndianPhone('98765')).toBeNull();
  });

  it('builds WhatsApp links with or without a recipient', () => {
    expect(whatsappUrl('Hi & bye')).toBe('https://wa.me/?text=Hi%20%26%20bye');
    expect(whatsappUrl('Hi', '919876543210')).toBe('https://wa.me/919876543210?text=Hi');
  });

  it('writes an invite that frames the ask as shagun', () => {
    const text = inviteMessage(wedding(), 'https://x.test/#/w/asha-weds-dev', 350000);
    expect(text).toContain('💍 Asha Rao & Dev Khanna are getting married on 12 Dec 2026');
    expect(text).not.toContain('🪔');
    expect(text).toContain('🎁 Honeymoon');
    expect(text).toContain('₹3.5 L');
    expect(text.trim().endsWith('https://x.test/#/w/asha-weds-dev')).toBeTrue();
  });
});
