import { contrast, validateDesign, validateInviteText, validateWhatsapp } from './ai/invite-prompts';
import { LEGACY_PALETTES, TEMPLATES, defaultInvite, designPicks, draftInviteText, inkFor, invitePages, knownTemplate, localDate, localEventName, migrateInvite, mixHex, nameList, templateId, templateMeta } from './invite';
import { INVITE_TEMPLATES } from './models';
import { TEMPLATE_FONTS, inviteFontVars } from '../shared/invite-fonts';
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
    expect(nameList('Rohan\nIshita, Kabir\n\n')).toEqual(['Rohan', 'Ishita, Kabir']);
  });

  it('picks a design from the city, venue and wishes', () => {
    expect(designPicks(wedding({ city: 'Ahmedabad' })).template).toBe('gujarati');
    expect(designPicks(wedding({ city: 'Udaipur', venue: 'City Palace' })).template).toBe('rajasthani');
    expect(designPicks(wedding({ city: 'Chennai', venue: 'Kalyana mandapam' })).template).toBe('south');
    const p = designPicks(wedding({ partner1: 'Asha Kapoor', city: 'Delhi', venue: 'Farmhouse' }), 'something fun in hinglish');
    expect([p.template, p.tone, p.language]).toEqual(['ganesh', 'fun', 'hinglish']);
  });
});

describe('template registry', () => {
  it('has ten styles, one per id, each with its own colours and fonts', () => {
    expect(TEMPLATES.length).toBe(10);
    expect(TEMPLATES.map((t) => t.id)).toEqual([...INVITE_TEMPLATES]);
    expect(new Set(TEMPLATES.map((t) => t.name)).size).toBe(10);
    expect(new Set(TEMPLATES.map((t) => JSON.stringify(t.palette))).size).toBe(10);
    for (const t of TEMPLATES) {
      expect(TEMPLATE_FONTS[t.id]).withContext(t.id).toBeDefined();
      expect(t.blurb.length).withContext(t.id).toBeLessThan(90);
    }
  });

  it('keeps the six original ids and adds the four new ones', () => {
    for (const id of ['ganesh', 'rajasthani', 'gujarati', 'south', 'royal', 'minimal', 'floral', 'mehndi', 'photo', 'phulkari']) {
      expect(templateMeta(id as never).id).toBe(id as never);
    }
  });

  it('maps stored, aliased and unknown ids onto current styles', () => {
    expect(templateId('royal')).toBe('royal');
    expect(templateId(' Phulkari ')).toBe('phulkari');
    expect(templateId('marigold')).toBe('rajasthani');
    expect(templateId('temple')).toBe('south');
    expect(templateId('henna')).toBe('mehndi');
    expect(templateId('disco')).toBe('ganesh');
    expect(templateId(undefined)).toBe('ganesh');
    expect(knownTemplate('disco')).toBeNull();
    expect(knownTemplate('save-the-date')).toBe('photo');
  });

  it('moves a saved design with an old default palette to the redrawn colours, and keeps chosen colours', () => {
    const w = wedding();
    const old = { ...defaultInvite(w, 'royal'), palette: { ...LEGACY_PALETTES.royal! } };
    expect(migrateInvite(old).palette).toEqual(templateMeta('royal').palette);
    expect(migrateInvite(old).text).toEqual(old.text);
    const custom = { ...defaultInvite(w, 'minimal'), palette: { primary: '#123456', accent: '#abcdef', paper: '#ffffff' } };
    expect(migrateInvite(custom)).toBe(custom);
    const current = defaultInvite(w, 'floral');
    expect(migrateInvite(current)).toBe(current);
    const unknown = migrateInvite({ ...defaultInvite(w), template: 'bandhani' as never });
    expect(unknown.template).toBe('gujarati');
    expect(unknown.palette).toEqual(templateMeta('gujarati').palette);
  });

  it('stacks each style font before the language font, so Indian scripts still have glyphs', () => {
    const f = inviteFontVars('royal', 'hindi');
    expect(f.display.startsWith("'Cinzel'")).toBeTrue();
    expect(f.display).toContain('Tiro Devanagari Hindi');
    expect(inviteFontVars('floral', 'english').script).toContain('Great Vibes');
    expect(inviteFontVars('mehndi', 'gujarati').body).toContain('Mukta Vaani');
  });

  it('mixes colours', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#9c1c1c', '#ffffff', 0)).toBe('#9c1c1c');
  });

  it('suggests the new styles from what the couple asks for first', () => {
    expect(designPicks(wedding({ city: 'Amritsar' })).template).toBe('phulkari');
    expect(designPicks(wedding({ city: 'Udaipur' }), 'a photo save the date').template).toBe('photo');
    expect(designPicks(wedding({ city: 'Ahmedabad' }), 'pastel flowers').template).toBe('floral');
    expect(designPicks(wedding(), 'henna line art').template).toBe('mehndi');
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
    expect(validateDesign({ template: 'mehndi', primary: '#6b3410', accent: '#b5652b', paper: '#fbf0df' }).template).toBe('mehndi');
    expect(validateDesign({ template: 'jharokha' }).template).toBe('rajasthani');
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
