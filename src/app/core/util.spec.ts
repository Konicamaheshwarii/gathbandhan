import { qrMatrix } from './qr';
import { firstName, slugify, uid, weddingSlug } from './util';

describe('util', () => {
  it('makes ASCII slugs that survive WhatsApp', () => {
    expect(slugify('Riya & Arjun')).toBe('riya-weds-arjun');
    expect(slugify('  Zoë   O’Neil!! ')).toBe('zoe-o-neil');
    expect(slugify('प्रिया')).toBe('');
    expect(weddingSlug('Riya Sharma', 'Arjun Mehta')).toBe('riya-weds-arjun');
    expect(weddingSlug('प्रिया', 'Rahul')).toBe('rahul');
    expect(weddingSlug('', '')).toBe('our-wedding');
  });

  it('extracts first names', () => {
    expect(firstName('  Sunita  Mausi ')).toBe('Sunita');
  });

  it('makes unique ids', () => {
    const ids = new Set(Array.from({ length: 500 }, () => uid('c')));
    expect(ids.size).toBe(500);
  });
});

describe('qrMatrix', () => {
  it('encodes a UPI link into an SVG path with a quiet zone', () => {
    const qr = qrMatrix('upi://pay?pa=a@ybl&pn=A&am=2100.00&cu=INR');
    expect(qr.size).toBe(qr.version * 4 + 17 + 4);
    expect(qr.path).toMatch(/^M\d+ \d+h\d+v1h-\d+z/);
    expect(qr.path).not.toContain('M0 0');
  });

  it('grows with longer content', () => {
    expect(qrMatrix('x'.repeat(600)).version).toBeGreaterThan(qrMatrix('short').version);
  });
});
