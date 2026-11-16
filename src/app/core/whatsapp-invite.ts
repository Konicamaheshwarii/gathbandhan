import { localDate, localEventName, localTime } from './invite';
import { EVENT_META, Guest, InviteLanguage, InviteTone, Wedding, WeddingEvent } from './models';
import { parseIsoDate } from './format';
import { tidyCase, wellFormed } from './text';
import { firstName } from './util';

/** Placeholders in a message template, filled in per guest. */
export const MSG = { name: '{name}', link: '{link}', rsvp: '{rsvp}', shagun: '{shagun}' } as const;

/** Functions listed in the message; the rest are "in the invite". */
export const MAX_EVENT_LINES = 4;

export interface InviteMessageOptions {
  language: InviteLanguage;
  tone: InviteTone;
  /** Adds a "🎁 Shagun" link. Off by default: asking for money can feel awkward. */
  includeShagun?: boolean;
}

interface Phrases {
  opener: Record<InviteTone, string>;
  hello: Record<InviteTone, string>;
  invite: Record<InviteTone, (couple: string) => string>;
  more: string;
  yourInvite: string;
  rsvp: string;
  shagun: string;
  blessing: Record<InviteTone, string>;
  signoff: Record<InviteTone, string>;
  families: string;
}

// WhatsApp formatting: *bold*, _italic_. Kept to 8-14 lines so it reads well on a phone.
const PHRASES: Record<InviteLanguage, Phrases> = {
  english: {
    opener: { traditional: '॥ Shree Ganeshaya Namah ॥', modern: '💍 *Save the date*', fun: '🎉 *Shaadi alert!* 🎉' },
    hello: { traditional: `Dear ${MSG.name},`, modern: `Hi ${MSG.name}!`, fun: `Hey ${MSG.name}!` },
    invite: {
      traditional: (c) => `With the blessings of our elders, we warmly invite you and your family to the wedding of ${c}.`,
      modern: (c) => `${c} are getting married, and it won't be the same without you.`,
      fun: (c) => `${c} are finally tying the knot, and you're on the VIP list! 💃`,
    },
    more: '_…and more in the invite_',
    yourInvite: '📩 Your invite',
    rsvp: '✅ RSVP',
    shagun: '🎁 Shagun',
    blessing: { traditional: '_Your presence is our greatest blessing._', modern: '_We would love to celebrate with you._', fun: '_Bring your dancing shoes!_' },
    signoff: { traditional: 'With warm regards,', modern: 'With love,', fun: 'See you on the dance floor,' },
    families: 'and families',
  },
  hindi: {
    opener: { traditional: '॥ श्री गणेशाय नमः ॥', modern: '💍 *शुभ विवाह*', fun: '🎉 *शादी की ख़ुशख़बरी!* 🎉' },
    hello: { traditional: `आदरणीय ${MSG.name},`, modern: `नमस्ते ${MSG.name},`, fun: `नमस्ते ${MSG.name}!` },
    invite: {
      traditional: (c) => `बड़ों के आशीर्वाद से, ${c} के शुभ विवाह में आप सपरिवार सादर आमंत्रित हैं।`,
      modern: (c) => `${c} की शादी है, और आपके बिना यह जश्न अधूरा है।`,
      fun: (c) => `${c} की शादी पक्की हो गई है! नाच-गाने के लिए तैयार रहिए 💃`,
    },
    more: '_…और भी कार्यक्रम निमंत्रण में_',
    yourInvite: '📩 आपका निमंत्रण पत्र',
    rsvp: '✅ RSVP',
    shagun: '🎁 शगुन',
    blessing: { traditional: '_आपकी उपस्थिति ही हमारा आशीर्वाद है।_', modern: '_आपके आने से हमारी ख़ुशी दोगुनी होगी।_', fun: '_ज़रूर आइएगा, मज़ा आएगा!_' },
    signoff: { traditional: 'सप्रेम,', modern: 'प्यार सहित,', fun: 'मिलते हैं शादी में,' },
    families: 'एवं परिवार',
  },
  gujarati: {
    opener: { traditional: '॥ શ્રી ગણેશાય નમઃ ॥', modern: '💍 *શુભ લગ્ન*', fun: '🎉 *લગ્નના ખુશખબર!* 🎉' },
    hello: { traditional: `આદરણીય ${MSG.name},`, modern: `નમસ્તે ${MSG.name},`, fun: `નમસ્તે ${MSG.name}!` },
    invite: {
      traditional: (c) => `વડીલોના આશીર્વાદથી, ${c}ના શુભ લગ્ન પ્રસંગે આપને સહપરિવાર પધારવા ભાવભર્યું આમંત્રણ છે.`,
      modern: (c) => `${c}ના લગ્ન છે, અને આપના વિના ઉજવણી અધૂરી છે.`,
      fun: (c) => `${c}ના લગ્ન નક્કી થઈ ગયા છે! ગરબા માટે તૈયાર રહેજો 💃`,
    },
    more: '_…બીજા પ્રસંગો કંકોત્રીમાં_',
    yourInvite: '📩 આપની કંકોત્રી',
    rsvp: '✅ RSVP',
    shagun: '🎁 શગુન',
    blessing: { traditional: '_આપની હાજરી એ જ અમારા આશીર્વાદ છે._', modern: '_આપ આવશો તો અમારી ખુશી બમણી થશે._', fun: '_જરૂર આવજો, મજા આવશે!_' },
    signoff: { traditional: 'સસ્નેહ,', modern: 'પ્રેમ સહિત,', fun: 'લગ્નમાં મળીએ,' },
    families: 'તથા પરિવાર',
  },
  hinglish: {
    opener: { traditional: '॥ Shree Ganeshaya Namah ॥', modern: '💍 *Shaadi ka invite*', fun: '🎉 *Shaadi alert!* 🎉' },
    hello: { traditional: `Aadarniya ${MSG.name},`, modern: `Namaste ${MSG.name}!`, fun: `Hey ${MSG.name}!` },
    invite: {
      traditional: (c) => `Badon ke aashirwad se, ${c} ki shaadi mein aap sapariwar saadar aamantrit hain.`,
      modern: (c) => `${c} ki shaadi hai, aur aapke bina yeh jashn adhoora hai.`,
      fun: (c) => `${c} ki shaadi pakki ho gayi hai! Naachne ke liye ready rehna 💃`,
    },
    more: '_…aur bhi functions invite mein_',
    yourInvite: '📩 Aapka invite',
    rsvp: '✅ RSVP',
    shagun: '🎁 Shagun',
    blessing: { traditional: '_Aapki upasthiti hi hamara aashirwad hai._', modern: '_Aap aaoge toh khushi double ho jayegi._', fun: '_Zaroor aana, full masti hogi!_' },
    signoff: { traditional: 'Saprem,', modern: 'Pyaar sahit,', fun: 'Shaadi mein milte hain,' },
    families: 'aur parivaar',
  },
};

const SHORT_DATE: Record<InviteLanguage, string> = { english: 'en-IN', hinglish: 'en-IN', hindi: 'hi-IN', gujarati: 'gu-IN' };

/** "शनि, 12 दिस॰" style short dates for the function lines. */
export function shortDate(iso: string, language: InviteLanguage): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  return new Intl.DateTimeFormat(SHORT_DATE[language], { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d);
}

/** "🔥 *Wedding* · Sat, 12 Dec · 7:30 pm · Jagmandir" */
export function eventLine(e: WeddingEvent, language: InviteLanguage): string {
  const parts = [`${EVENT_META[e.kind]?.emoji ?? '✨'} *${tidyCase(localEventName(e, language))}*`, shortDate(e.date, language)];
  if (e.time) parts.push(localTime(e.time, language));
  // The first part of the venue ("Lakeside Lawns"); the full address is in the invite.
  const venue = (e.venue ?? '').split(',')[0].trim();
  if (venue) parts.push(tidyCase(venue));
  return parts.join(' · ');
}

/** The couple's first names, capitalised: "John & Jenny". */
export function coupleNames(w: Pick<Wedding, 'partner1' | 'partner2'>): string {
  return `${tidyCase(firstName(w.partner1))} & ${tidyCase(firstName(w.partner2))}`;
}

/**
 * The default message, with {name}, {link}, {rsvp} (and {shagun}) left in for each guest.
 * Short, warm and kankotri-like: an opening line, the greeting, the invitation, the date and
 * up to four functions, the links, a blessing, and the couple (or families) signing off.
 */
export function inviteMessageTemplate(w: Wedding, opts: InviteMessageOptions): string {
  const p = PHRASES[opts.language] ?? PHRASES.english;
  const tone = opts.tone;
  const couple = `*${coupleNames(w)}*`;
  const place = tidyCase((w.city || w.venue || '').trim());
  const events = [...(w.events ?? [])].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

  const lines: string[] = [p.opener[tone], '', p.hello[tone], '', p.invite[tone](couple), `📅 ${localDate(w.date, opts.language)}${place ? ` · ${place}` : ''}`];
  if (events.length) {
    lines.push('');
    events.slice(0, MAX_EVENT_LINES).forEach((e) => lines.push(eventLine(e, opts.language)));
    if (events.length > MAX_EVENT_LINES) lines.push(p.more);
  }
  lines.push('', `${p.yourInvite}: ${MSG.link}`, `${p.rsvp}: ${MSG.rsvp}`);
  if (opts.includeShagun) lines.push(`${p.shagun}: ${MSG.shagun}`);
  const fams = [w.families?.bride, w.families?.groom].map((f) => f?.trim()).filter(Boolean);
  lines.push('', p.blessing[tone], p.signoff[tone], fams.length === 2 ? `*${coupleNames(w)}* _${p.families}_` : couple);
  return lines.join('\n');
}

const RESPECTFUL = /\b(ji|parivar|parivaar|family|families|uncle|aunty|auntie|mausi|mama|mami|chacha|chachi|bua|dadi|nani|dada|nana|bhaiya|didi|sir|madam|shri|smt)\b|जी|परिवार|જી|પરિવાર/i;

/**
 * How the message addresses a guest: their saved greeting or name, capitalised, with "ji" where
 * natural. The honorific follows the script the name was typed in, so a Hindi message says
 * "कोनिका जी" for a Devanagari name and "Konica ji" for a Latin one (never "konica जी").
 */
export function addressGuest(g: Pick<Guest, 'name' | 'greeting'>, language: InviteLanguage, tone: InviteTone = 'traditional'): string {
  const base = tidyCase((g.greeting?.trim() || g.name.trim()).replace(/\s+/g, ' '));
  if (language === 'english' || tone === 'fun' || RESPECTFUL.test(base)) return base;
  if (/\p{Script=Devanagari}/u.test(base)) return `${base} जी`;
  if (/\p{Script=Gujarati}/u.test(base)) return `${base} જી`;
  return `${base} ji`;
}

export interface GuestLinks {
  invite: string;
  rsvp: string;
  shagun: string;
}

/** Fills one guest's name and links into a template (the default or one the couple edited). */
export function personaliseInvite(template: string, g: Pick<Guest, 'name' | 'greeting'>, links: GuestLinks, language: InviteLanguage, tone: InviteTone = 'traditional'): string {
  return wellFormed(
    template
      .split(MSG.name).join(addressGuest(g, language, tone))
      .split(MSG.link).join(links.invite)
      .split(MSG.rsvp).join(links.rsvp)
      .split(MSG.shagun).join(links.shagun),
  );
}

/** WhatsApp formatting as HTML for the preview bubble: *bold*, _italic_, ~strike~, links. Escapes everything else. */
export function whatsappToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return esc(text)
    .replace(/(^|[\s(])\*([^*\n]+?)\*(?=[\s).,!?:]|$)/gm, '$1<strong>$2</strong>')
    .replace(/(^|[\s(])_([^_\n]+?)_(?=[\s).,!?:]|$)/gm, '$1<em>$2</em>')
    .replace(/(^|[\s(])~([^~\n]+?)~(?=[\s).,!?:]|$)/gm, '$1<s>$2</s>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/\n/g, '<br>');
}
