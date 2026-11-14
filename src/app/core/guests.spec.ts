import { guestStatus, inviteUrl, inviteWhatsappText, isGuestToken, mergeGuests, newGuestToken, parseGuestList } from './guests';
import { Guest } from './models';
import { wedding } from './testing';

const guest = (patch: Partial<Guest> = {}): Guest => ({ id: 'g', weddingId: 'w1', name: 'Sharma Ji', token: 'abcdefgh23', createdAt: 1, ...patch });

describe('guest list', () => {
  it('makes unguessable, link-safe tokens', () => {
    const tokens = new Set(Array.from({ length: 200 }, newGuestToken));
    expect(tokens.size).toBe(200);
    for (const t of tokens) expect(isGuestToken(t)).toBeTrue();
    expect(isGuestToken('../etc')).toBeFalse();
  });

  it('reports the furthest step a guest reached', () => {
    expect(guestStatus(guest())).toBe('not-sent');
    expect(guestStatus(guest({ sentAt: 1 }))).toBe('sent');
    expect(guestStatus(guest({ sentAt: 1, openedAt: 2 }))).toBe('opened');
    expect(guestStatus(guest({ openedAt: 2, rsvpAt: 3 }))).toBe('rsvp');
    expect(guestStatus(guest({ rsvpAt: 3, gaveAt: 4 }))).toBe('gave');
  });

  it('reads a CSV with headers in any order', () => {
    const csv = 'Phone,Name,Side,Group\n+91 98220 12345,Sunita Mausi,Bride,Mummy\'s side\n"98765 43210","Rao, Deepa",groom,"Office"\n,X,,\n';
    const { guests, skipped } = parseGuestList(csv);
    expect(guests).toEqual([
      { name: 'Sunita Mausi', phone: '919822012345', side: 'bride', group: "Mummy's side" },
      { name: 'Rao, Deepa', phone: '919876543210', side: 'groom', group: 'Office' },
    ]);
    expect(skipped).toBe(1);
  });

  it('reads lines pasted from contacts or WhatsApp', () => {
    const { guests } = parseGuestList('Pooja Bua +91 98765 01234\nGupta Uncle, 9811066666, groom, Family friends\nLakshmi Aunty');
    expect(guests[0]).toEqual({ name: 'Pooja Bua', phone: '919876501234' });
    expect(guests[1]).toEqual({ name: 'Gupta Uncle', phone: '919811066666', side: 'groom', group: 'Family friends' });
    expect(guests[2]).toEqual({ name: 'Lakshmi Aunty' });
  });

  it('skips people already on the list', () => {
    const existing = [guest({ phone: '919822012345' }), guest({ name: 'Lakshmi Aunty' })];
    const merged = mergeGuests('w1', existing, [
      { name: 'Sunita', phone: '919822012345' }, { name: 'lakshmi aunty' }, { name: 'New Person' }, { name: 'New Person' },
    ]);
    expect(merged.map((g) => g.name)).toEqual(['New Person']);
    expect(isGuestToken(merged[0].token)).toBeTrue();
  });

  it('writes a personal WhatsApp invite with the guest link in each language', () => {
    const w = wedding({ city: 'Mumbai' });
    const url = inviteUrl('asha-weds-dev', 'abcdefgh23', 'https://x.github.io/shagun-wishlist/');
    expect(url).toBe('https://x.github.io/shagun-wishlist/#/i/asha-weds-dev/abcdefgh23');
    const en = inviteWhatsappText(w, { name: 'Sharma Ji', greeting: 'Sharma Parivar' }, url, 'english');
    expect(en).toContain('Dear Sharma Parivar');
    expect(en).toContain('Asha & Dev');
    expect(en).toContain(url);
    expect(inviteWhatsappText(w, { name: 'Sharma Ji' }, url, 'hindi')).toContain('सादर आमंत्रित');
    expect(inviteWhatsappText(w, { name: 'Sharma Ji' }, url, 'gujarati')).toContain('આમંત્રણ');
  });
});
