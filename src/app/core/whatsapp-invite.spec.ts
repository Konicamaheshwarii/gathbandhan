import { validateWhatsapp } from './ai/invite-prompts';
import { DemoProvider } from './llm/demo.provider';
import { INVITE_LANGUAGES, INVITE_TONES, WeddingEvent } from './models';
import { whatsappUrl } from './share';
import { wedding } from './testing';
import { graphemes, hasBrokenCharacters, tidyCase, truncateText, wellFormed } from './text';
import { MSG, addressGuest, eventLine, inviteMessageTemplate, personaliseInvite, whatsappToHtml } from './whatsapp-invite';

const ev = (id: string, kind: WeddingEvent['kind'], date: string, time: string, venue: string, name = ''): WeddingEvent =>
  ({ id, kind, name, date, time, venue });

const W = wedding({
  partner1: 'john smith', partner2: 'jenny', city: 'UDaipur', date: '2027-02-17', slug: 'john-weds-jenny',
  events: [
    ev('e1', 'haldi', '2027-02-15', '10:00', 'Lake Pichola ghat'),
    ev('e2', 'mehndi', '2027-02-15', '16:00', 'Hotel garden'),
    ev('e3', 'sangeet', '2027-02-16', '19:30', 'Jagmandir'),
    ev('e4', 'wedding', '2027-02-17', '19:00', 'Jagmandir'),
    ev('e5', 'reception', '2027-02-18', '20:00', 'City Palace'),
  ],
});
const LINKS = { invite: 'https://konicamaheshwarii.github.io/gathbandhan/#/i/john-weds-jenny/CzHh2wxDcB', rsvp: 'https://x/#/w/john-weds-jenny/rsvp', shagun: 'https://x/#/w/john-weds-jenny/give' };

/** No replacement character, no lone surrogate, in the text and in the WhatsApp link once decoded. */
function expectClean(text: string, context: string): void {
  expect(hasBrokenCharacters(text)).withContext(`${context}: text`).toBeFalse();
  const url = whatsappUrl(text, '919876543210');
  const decoded = new URL(url).searchParams.get('text')!;
  expect(decoded).withContext(`${context}: url round trip`).toBe(text);
  expect(hasBrokenCharacters(decoded)).withContext(`${context}: url`).toBeFalse();
}

describe('WhatsApp invite messages', () => {
  for (const { id: language } of INVITE_LANGUAGES) {
    for (const tone of INVITE_TONES) {
      for (const includeShagun of [false, true]) {
        it(`builds a clean ${language} ${tone} message${includeShagun ? ' with shagun' : ''}`, () => {
          const template = inviteMessageTemplate(W, { language, tone, includeShagun });
          expect(template).toContain(MSG.name);
          expect(template).toContain(MSG.link);
          expect(template).toContain(MSG.rsvp);
          expect(template.includes(MSG.shagun)).toBe(includeShagun);
          const text = personaliseInvite(template, { name: 'konica', greeting: '' }, LINKS, language, tone);
          expectClean(text, `${language}/${tone}`);
          expect(text).toContain('*John & Jenny*');
          expect(text).toContain('Udaipur');
          expect(text).not.toContain('UDaipur');
          expect(text).toContain(`: ${LINKS.invite}`);
          expect(text).toContain(`RSVP: ${LINKS.rsvp}`);
          expect(text).not.toMatch(/\{(name|link|rsvp|shagun)\}/);
          const lines = text.split('\n').filter((l) => l.trim());
          expect(lines.length).withContext('short enough for a phone').toBeLessThanOrEqual(16);
          expect(lines.length).toBeGreaterThanOrEqual(8);
          // four functions, then "more in the invite"
          expect(text.split('\n').filter((l) => /^(🌼|🌿|🎶|🔥|🥂|✨) \*/.test(l)).length).toBe(4);
          expect(text).not.toContain('City Palace');
        });
      }
    }
  }

  it('localises function names and dates', () => {
    const hi = inviteMessageTemplate(W, { language: 'hindi', tone: 'traditional' });
    expect(hi).toContain('*हल्दी*');
    expect(hi).toMatch(/फ़र॰|फ़रवरी/);
    expect(hi).toContain('॥ श्री गणेशाय नमः ॥');
    const gu = inviteMessageTemplate(W, { language: 'gujarati', tone: 'traditional' });
    expect(gu).toContain('*પીઠી*'); // what Gujarati families call haldi
    expect(gu).toMatch(/ફેબ્રુ/);
    const en = inviteMessageTemplate(W, { language: 'english', tone: 'modern' });
    expect(en).toContain('💍 *Save the date*');
    expect(en).toMatch(/🌼 \*Haldi\* · Mon, 15 Feb · 10:00 am · Lake Pichola Ghat/);
  });

  it('works without functions', () => {
    const text = personaliseInvite(inviteMessageTemplate(wedding(), { language: 'hindi', tone: 'modern' }), { name: 'Sharma Ji' }, LINKS, 'hindi', 'modern');
    expectClean(text, 'no events');
    expect(text).not.toContain('…');
  });

  it('addresses guests properly, the honorific following the script of their name', () => {
    expect(addressGuest({ name: 'konica' }, 'hindi')).toBe('Konica ji');
    expect(addressGuest({ name: 'कोनिका' }, 'hindi')).toBe('कोनिका जी');
    expect(addressGuest({ name: 'કોનિકા' }, 'gujarati')).toBe('કોનિકા જી');
    expect(addressGuest({ name: 'konica maheshwari' }, 'english')).toBe('Konica Maheshwari');
    expect(addressGuest({ name: 'x', greeting: 'sharma parivar' }, 'hindi')).toBe('Sharma Parivar');
    expect(addressGuest({ name: 'Sunita Mausi' }, 'hinglish')).toBe('Sunita Mausi');
    expect(addressGuest({ name: 'rahul' }, 'hindi', 'fun')).toBe('Rahul');
  });

  it('renders WhatsApp formatting safely in the preview', () => {
    const html = whatsappToHtml('*John & Jenny*\n_blessed_ <b>x</b> https://a.test/#/i/x');
    expect(html).toContain('<strong>John &amp; Jenny</strong>');
    expect(html).toContain('<em>blessed</em>');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).toContain('<a href="https://a.test/#/i/x"');
    expect(html).toContain('<br>');
  });

  it('keeps the offline AI tier (demo writer) clean in every language and tone', async () => {
    const demo = new DemoProvider(0);
    for (const { id: language } of INVITE_LANGUAGES) {
      for (const tone of INVITE_TONES) {
        const input = { wedding: W, greeting: MSG.name, url: MSG.link, rsvpUrl: MSG.rsvp, language, tone };
        const raw = await demo.complete({ task: 'whatsapp', input, language, system: '', prompt: '' });
        const t = validateWhatsapp(raw, input);
        expect(t).toContain(MSG.link);
        expect(t).toContain(MSG.rsvp);
        expectClean(personaliseInvite(t, { name: 'Konica' }, LINKS, language, tone), `demo ${language}/${tone}`);
      }
    }
  });

  it('drops broken characters from an AI reply and keeps the links', () => {
    const input = { wedding: W, greeting: MSG.name, url: MSG.link, rsvpUrl: MSG.rsvp, language: 'hindi' as const, tone: 'modern' as const };
    const t = validateWhatsapp('� नमस्ते {name}, शादी में ज़रूर आइए \uD83D', input);
    expect(hasBrokenCharacters(t)).toBeFalse();
    expect(t).toContain('📩 {link}');
    expect(t).toContain('✅ RSVP: {rsvp}');
  });
});

describe('text helpers', () => {
  it('never splits an emoji when truncating', () => {
    expect(truncateText('ab🙏cd', 3)).toBe('ab🙏');
    expect(truncateText('👨‍👩‍👧 family', 1)).toBe('👨‍👩‍👧');
    expect(truncateText('🙏🙏🙏', 2, '…')).toBe('🙏…');
    expect(hasBrokenCharacters(truncateText('🙏'.repeat(50), 7))).toBeFalse();
    expect(graphemes('नमस्ते').length).toBeLessThan('नमस्ते'.length);
  });

  it('removes lone surrogates but keeps valid emoji', () => {
    expect(wellFormed('a\uD83Db🙏')).toBe('ab🙏');
    expect(wellFormed('\uDE4Fx')).toBe('x');
    expect(() => encodeURIComponent(wellFormed('\uD83D'))).not.toThrow();
  });

  it('tidies odd capitalisation for display', () => {
    expect(tidyCase('UDaipur')).toBe('Udaipur');
    expect(tidyCase('konica maheshwari')).toBe('Konica Maheshwari');
    expect(tidyCase('NEW DELHI')).toBe('New Delhi');
    expect(tidyCase('IIT Bombay')).toBe('IIT Bombay');
    expect(tidyCase('DeSouza')).toBe('DeSouza');
    expect(tidyCase('उदयपुर')).toBe('उदयपुर');
  });
});
