import { wedding } from './testing';
import { decodeWedding, encodeWedding, packWedding, toBase64Url, unpackWedding, weddingUrl } from './wedding-link';

describe('wedding share links', () => {
  it('round-trips a wedding through the link', async () => {
    const w = wedding({ story: 'हम मिले थे एक ट्रेन में 🚆', showAmounts: true, goals: [{ id: 'g1', title: 'Honeymoon', target: 300000, emoji: '🌍', description: 'Ten days' }] });
    const encoded = await encodeWedding(w);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    const back = await decodeWedding(encoded);
    expect(back).toEqual(jasmine.objectContaining({
      slug: w.slug, partner1: w.partner1, partner2: w.partner2, date: w.date, venue: w.venue, city: w.city,
      story: w.story, upiId: w.upiId, payeeName: w.payeeName, showAmounts: true, cover: { preset: 'rose' },
    }));
    expect(back.goals).toEqual(w.goals);
  });

  it('carries functions, families and the story timeline (version 2), and still opens version 1 links', async () => {
    const w = wedding({
      events: [{ id: 'e1', kind: 'sangeet', name: 'Sangeet', date: '2026-12-11', time: '19:30', venue: 'Durbar Hall', mapsUrl: 'https://maps.app.goo.gl/x', dressCode: 'Indo-western' }],
      families: { bride: 'Mrs. & Mr. Rao', groom: 'Mrs. & Mr. Khanna' },
      milestones: [{ id: 'm1', when: '2019', title: 'Train chai', text: 'We met.', emoji: '☕' }],
      gallery: [{ id: 'p1', url: 'data:image/jpeg;base64,AAAA' }],
    });
    const back = await decodeWedding(await encodeWedding(w));
    expect(back.events).toEqual(w.events!);
    expect(back.families).toEqual(w.families!);
    expect(back.milestones).toEqual(w.milestones!);
    expect(back.gallery).toBeUndefined();

    const v1 = packWedding(w).slice(0, 13);
    v1[0] = 1;
    expect(unpackWedding(v1).events).toEqual([]);
  });

  it('leaves uploaded photos out to keep links short', async () => {
    const w = wedding({ cover: { preset: 'peacock', imageUrl: 'data:image/jpeg;base64,' + 'A'.repeat(50_000) } });
    const encoded = await encodeWedding(w);
    expect(encoded.length).toBeLessThan(1000);
    expect((await decodeWedding(encoded)).cover).toEqual({ preset: 'peacock' });
  });

  it('rejects damaged or tampered links', async () => {
    await expectAsync(decodeWedding('not base64!')).toBeRejectedWithError(/damaged/);
    await expectAsync(decodeWedding('AAAA')).toBeRejectedWithError(/damaged/);
    await expectAsync(decodeWedding('')).toBeRejectedWithError(/damaged/);
  });

  it('validates fields when unpacking', () => {
    const packed = packWedding(wedding());
    expect(unpackWedding(packed).upiId).toBe('asha.dev@okaxis');
    const badUpi = [...packed];
    badUpi[9] = 'javascript:alert(1)';
    expect(() => unpackWedding(badUpi)).toThrowError(/damaged/);
    const noGoals = [...packed];
    noGoals[12] = [];
    expect(() => unpackWedding(noGoals)).toThrow();
    const wrongVersion = [...packed];
    wrongVersion[0] = 99;
    expect(() => unpackWedding(wrongVersion)).toThrow();
  });

  it('builds hash-routed URLs under any base path', () => {
    expect(weddingUrl('a-weds-b', undefined, 'https://u.github.io/gathbandhan/')).toBe('https://u.github.io/gathbandhan/#/w/a-weds-b');
    expect(weddingUrl('a-weds-b', 'xyz', 'https://h/')).toBe('https://h/#/w/a-weds-b?d=xyz');
    expect(toBase64Url(new Uint8Array([251, 255]))).toBe('-_8');
  });
});
