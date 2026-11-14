import { contrast, validateDesign, validateInviteText, validateWhatsapp } from './ai/invite-prompts';
import { TEMPLATES, defaultInvite, designPicks, draftInviteText, inkFor, invitePages, localDate, localEventName, nameList } from './invite';
import { jpegSize, buildPdf } from './pdf';
import { wedding } from './testing';

describe('invite text', () => {
  const w = wedding({ families: { bride: 'Mrs. & Mr. Rao', groom: 'Mrs. & Mr. Khanna' } });

  it('writes a traditional kankotri in four languages, naming parents and the couple', () => {
    const en = draftInviteText(w, 'english', 'traditional', 'ganesh');
    expect(en.invocation).toContain('Shree Ganeshaya Namah');
    expect(en.invitation).toContain('Mrs. & Mr. Rao and Mrs. & Mr. Khanna');
    expect(en.invitation).toContain('Asha and Dev');
    expect(draftInviteText(w, 'hindi', 'traditional', 'ganesh').invocation).toBe('॥ श्री गणेशाय नमः ॥');
    expect(draftInviteText(w, 'gujarati', 'traditional', 'gujarati').title).toBe('શુભ લગ્ન');
    expect(draftInviteText(w, 'hinglish', 'fun', 'ganesh').invocation).not.toContain('Ganesh');
    expect(draftInviteText(wedding(), 'english', 'traditional', 'minimal').invitation).toContain('we, Asha and Dev');
  });

  it('keeps every template readable: body ink against paper', () => {
    for (const t of TEMPLATES) expect(contrast(inkFor(t.palette), t.palette.paper)).toBeGreaterThanOrEqual(4.5);
  });

  it('lays out pages: cover, invitation, families, functions three per page, then RSVP', () => {
    const ev = (i: number) => ({ id: `e${i}`, kind: 'custom' as const, name: `F${i}`, date: `2026-12-1${i}`, time: '10:00', venue: 'V' });
    const pages = invitePages({ ...w, events: [1, 2, 3, 4].map(ev) }, defaultInvite(w));
    expect(pages.map((p) => p.kind)).toEqual(['cover', 'invitation', 'families', 'events', 'events', 'final']);
    const bare = invitePages(wedding(), defaultInvite(wedding()));
    expect(bare.map((p) => p.kind)).toEqual(['cover', 'invitation', 'final']);
  });

  it('localises function names and dates', () => {
    const e = { id: 'e', kind: 'mehndi' as const, name: 'Mehndi', date: '2026-12-10', time: '16:00', venue: 'V' };
    expect(localEventName(e, 'hindi')).toBe('मेहंदी');
    expect(localEventName({ ...e, name: 'Mehndi by the lake' }, 'gujarati')).toBe('Mehndi by the lake');
    expect(localDate('2026-12-12', 'english')).toContain('December');
    expect(localDate('2026-12-12', 'hindi')).toContain('दिसंबर');
    expect(nameList('Rohan\nIshita, Kabir\n\n')).toEqual(['Rohan', 'Ishita', 'Kabir']);
  });

  it('picks a design from the city, venue and wishes', () => {
    expect(designPicks(wedding({ city: 'Ahmedabad' })).template).toBe('gujarati');
    expect(designPicks(wedding({ city: 'Udaipur', venue: 'City Palace' })).template).toBe('rajasthani');
    expect(designPicks(wedding({ city: 'Chennai', venue: 'Kalyana mandapam' })).template).toBe('south');
    const p = designPicks(wedding({ partner1: 'Asha Kapoor', city: 'Delhi', venue: 'Farmhouse' }), 'something fun in hinglish');
    expect([p.template, p.tone, p.language]).toEqual(['ganesh', 'fun', 'hinglish']);
  });
});

describe('AI invite validation', () => {
  const input = { wedding: wedding(), language: 'english' as const, tone: 'traditional' as const, template: 'ganesh' as const };

  it('accepts good invite text and always keeps the canonical shlok', () => {
    const t = validateInviteText({ invocation: 'Om', title: 'Shubh Vivah', invitation: 'Join Asha and Dev for their wedding.', closing: 'See you!', shlok: 'made up' }, input);
    expect(t.title).toBe('Shubh Vivah');
    expect(t.shlok).toContain('Vakratunda');
    expect(() => validateInviteText({ title: 'x', invitation: 'Join us for the wedding.' }, input)).toThrowError(/left out/);
    expect(() => validateInviteText({}, input)).toThrow();
  });

  it('never loses the guest link in an AI WhatsApp message', () => {
    const wa = { wedding: wedding(), greeting: 'Sharma Parivar', url: 'https://x/#/i/a/abcdefgh23', language: 'english' as const, tone: 'modern' as const };
    expect(validateWhatsapp('Namaste! Please come to our wedding, it would mean the world.', wa)).toContain(wa.url);
    expect(() => validateWhatsapp('hi', wa)).toThrow();
  });

  it('rejects unknown templates and unreadable colours from the AI', () => {
    expect(() => validateDesign({ template: 'disco' })).toThrow();
    const pick = validateDesign({ template: 'royal', primary: '#ffffff', accent: '#ffff00', paper: '#fefefe', tone: 'fun', language: 'gujarati' });
    expect(pick.palette).toEqual(TEMPLATES.find((t) => t.id === 'royal')!.palette);
    expect([pick.tone, pick.language]).toEqual(['fun', 'gujarati']);
    const ok = validateDesign({ template: 'minimal', primary: '#123456', accent: '#c08b5c', paper: '#fdfbf7' });
    expect(ok.palette.primary).toBe('#123456');
  });
});

describe('PDF export', () => {
  // A 2x3 baseline JPEG header (SOI, APP0, SOF0) is enough for the writer.
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x03, 0x00, 0x02, 0x03, 0x01, 0x22, 0x00, 0xff, 0xd9]);

  it('reads JPEG dimensions', () => {
    expect(jpegSize(jpeg)).toEqual({ width: 2, height: 3 });
    expect(jpegSize(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it('writes one page per image with a valid cross-reference table', () => {
    const pdf = buildPdf([{ jpeg, width: 1080, height: 1920 }, { jpeg, width: 1080, height: 1920 }], 'Riya & Arjun');
    const text = new TextDecoder('latin1').decode(pdf);
    expect(text.startsWith('%PDF-1.4')).toBeTrue();
    expect(text).toContain('/Count 2');
    expect(text).toContain('/MediaBox [0 0 405 720]');
    expect(text.trimEnd().endsWith('%%EOF')).toBeTrue();
    const xref = +/startxref\n(\d+)/.exec(text)![1];
    expect(text.slice(xref, xref + 4)).toBe('xref');
    const offsets = [...text.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => +m[1]);
    offsets.forEach((o, i) => expect(text.slice(o).startsWith(`${i + 1} 0 obj`)).toBeTrue());
  });
});
