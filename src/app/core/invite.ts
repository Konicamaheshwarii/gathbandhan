import { eventName, sortEvents } from './calendar';
import { parseIsoDate } from './format';
import {
  EventKind, INVITE_TEMPLATES, InviteDesign, InviteLanguage, InvitePalette, InviteTemplate, InviteText, InviteTone, Wedding, WeddingEvent,
} from './models';
import { firstName } from './util';

// ---------- templates ----------

export interface TemplateMeta {
  id: InviteTemplate;
  name: string;
  /** One line for the style picker. */
  blurb: string;
  palette: InvitePalette;
  /** Templates that open with "Shree Ganeshaya Namah" by tradition. */
  invocation: boolean;
  defaultLanguage: InviteLanguage;
  /** Whether the cover shows the couple's photo (the other styles keep it for the web page). */
  photo: boolean;
}

export const TEMPLATES: TemplateMeta[] = [
  { id: 'ganesh', name: 'Shree Ganesh classic', blurb: 'Double-ruled frame, Ganesh on top and a centred stack in kumkum red on ivory', palette: { primary: '#9c1c1c', accent: '#c8901a', paper: '#fff8ec' }, invocation: true, defaultLanguage: 'hindi', photo: true },
  { id: 'rajasthani', name: 'Rajasthani jharokha', blurb: 'A haveli doorway of scalloped arches, marigold toran, peacocks and elephants', palette: { primary: '#b0215a', accent: '#e3a21a', paper: '#fff4dc' }, invocation: true, defaultLanguage: 'english', photo: true },
  { id: 'gujarati', name: 'Gujarati kankotri', blurb: 'Full bandhani dots, mirror-work and a kalash over a framed panel', palette: { primary: '#a3122a', accent: '#1d7a46', paper: '#fff8ec' }, invocation: true, defaultLanguage: 'gujarati', photo: false },
  { id: 'south', name: 'South Indian temple', blurb: 'Gopuram, saree temple border, banana leaves, thoranam and kolam', palette: { primary: '#0f5132', accent: '#c9971c', paper: '#fdf6e3' }, invocation: true, defaultLanguage: 'english', photo: false },
  { id: 'royal', name: 'Royal monogram', blurb: "A maroon scroll with gold filigree and the couple's crest", palette: { primary: '#e2bf63', accent: '#f6e3a6', paper: '#4a0a1e' }, invocation: false, defaultLanguage: 'english', photo: false },
  { id: 'minimal', name: 'Modern minimal', blurb: 'Big editorial type, white space and a thin knot monogram', palette: { primary: '#1f1d1b', accent: '#c0532d', paper: '#faf7f2' }, invocation: false, defaultLanguage: 'english', photo: false },
  { id: 'floral', name: 'Floral watercolour', blurb: 'Pastel roses and leaves around the names in a flowing script', palette: { primary: '#7d4660', accent: '#e79bb0', paper: '#fffaf7' }, invocation: false, defaultLanguage: 'english', photo: false },
  { id: 'mehndi', name: 'Mehndi line-art', blurb: 'A henna mandala and paisleys drawn by hand around the couple', palette: { primary: '#6b3410', accent: '#b5652b', paper: '#fbf0df' }, invocation: true, defaultLanguage: 'hindi', photo: false },
  { id: 'photo', name: 'Photo save-the-date', blurb: 'Your photo full-bleed with the names on top, like a film poster', palette: { primary: '#f3c86b', accent: '#ef7b62', paper: '#17121c' }, invocation: false, defaultLanguage: 'english', photo: true },
  { id: 'phulkari', name: 'Phulkari baraat', blurb: 'Bold Punjabi phulkari bands, a dhol and baraat colours', palette: { primary: '#b0124c', accent: '#f6a21a', paper: '#fff6e6' }, invocation: false, defaultLanguage: 'hinglish', photo: false },
];

export const templateMeta = (id: InviteTemplate): TemplateMeta => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];

/** Names older builds or AI replies may use for a style. */
const TEMPLATE_ALIASES: Record<string, InviteTemplate> = {
  classic: 'ganesh', 'shree-ganesh': 'ganesh', kankotri: 'gujarati', bandhani: 'gujarati',
  marigold: 'rajasthani', jharokha: 'rajasthani', temple: 'south', 'south-indian': 'south',
  maroon: 'royal', 'royal-maroon': 'royal', monogram: 'royal', modern: 'minimal',
  watercolour: 'floral', watercolor: 'floral', henna: 'mehndi', poster: 'photo', 'save-the-date': 'photo', punjabi: 'phulkari',
};

/** A current template id or a known older name for one; null for anything else. */
export function knownTemplate(raw: unknown): InviteTemplate | null {
  const id = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return (INVITE_TEMPLATES as readonly string[]).includes(id) ? (id as InviteTemplate) : TEMPLATE_ALIASES[id] ?? null;
}

/** Any stored or suggested template id, mapped onto a style that exists today. */
export const templateId = (raw: unknown): InviteTemplate => knownTemplate(raw) ?? 'ganesh';

/** The default colours of the first six styles before they were redrawn. */
export const LEGACY_PALETTES: Partial<Record<InviteTemplate, InvitePalette>> = {
  ganesh: { primary: '#9c1c1c', accent: '#d4a017', paper: '#fff6e0' },
  rajasthani: { primary: '#a3261f', accent: '#f29a1d', paper: '#fff1d6' },
  gujarati: { primary: '#8f1630', accent: '#1f7a4a', paper: '#fffaf0' },
  south: { primary: '#14532d', accent: '#c9971c', paper: '#fdf6e3' },
  royal: { primary: '#d4af37', accent: '#f3d98b', paper: '#4a0a1e' },
  minimal: { primary: '#2f2a26', accent: '#b9835a', paper: '#fbf8f3' },
};

const samePalette = (a: InvitePalette, b: InvitePalette) =>
  (['primary', 'accent', 'paper'] as const).every((k) => a[k]?.toLowerCase() === b[k]?.toLowerCase());

/**
 * A saved design on today's styles: unknown ids map to a current one, and a design that still has a
 * style's old default colours gets the redrawn style's colours. Colours the couple chose are kept.
 */
export function migrateInvite(d: InviteDesign): InviteDesign {
  const template = templateId(d.template);
  const legacy = LEGACY_PALETTES[template];
  const keepColours = d.template === template && !!d.palette && !(legacy && samePalette(d.palette, legacy));
  const palette = keepColours ? d.palette : { ...templateMeta(template).palette };
  return template === d.template && palette === d.palette ? d : { ...d, template, palette };
}

/** Mixes two #rrggbb colours: t = 0 gives a, t = 1 gives b. */
export function mixHex(a: string, b: string, t: number): string {
  const rgb = (h: string) => {
    const m = /^#?([0-9a-f]{6})$/i.exec((h ?? '').trim());
    return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : [128, 128, 128];
  };
  const [x, y] = [rgb(a), rgb(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/** Relative luminance (WCAG) of a #rrggbb colour. */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Body text colour that stays readable on the paper colour. */
export function inkFor(palette: InvitePalette): string {
  return luminance(palette.paper) < 0.18 ? '#fbeedd' : '#2a1613';
}

// ---------- words ----------

const SHLOK: Record<InviteLanguage, string> = {
  hindi: 'वक्रतुण्ड महाकाय सूर्यकोटि समप्रभ।\nनिर्विघ्नं कुरु मे देव सर्वकार्येषु सर्वदा॥',
  gujarati: 'વક્રતુંડ મહાકાય સૂર્યકોટિ સમપ્રભ।\nનિર્વિઘ્નં કુરુ મે દેવ સર્વકાર્યેષુ સર્વદા॥',
  english: 'Vakratunda Mahakaya Suryakoti Samaprabha,\nNirvighnam Kuru Me Deva Sarva-Kaaryeshu Sarvada.',
  hinglish: 'Vakratunda Mahakaya Suryakoti Samaprabha,\nNirvighnam Kuru Me Deva Sarva-Kaaryeshu Sarvada.',
};

const INVOCATION: Record<InviteLanguage, { ganesh: string; plain: string }> = {
  hindi: { ganesh: '॥ श्री गणेशाय नमः ॥', plain: 'सप्रेम निमंत्रण' },
  gujarati: { ganesh: '॥ શ્રી ગણેશાય નમઃ ॥', plain: 'સ્નેહ નિમંત્રણ' },
  english: { ganesh: '|| Shree Ganeshaya Namah ||', plain: 'Together with their families' },
  hinglish: { ganesh: '|| Shree Ganeshaya Namah ||', plain: 'Aap sab ke aashirwad se' },
};

interface Names {
  a: string;
  b: string;
  parents: string;
}

type Copy = Record<InviteTone, { title: string; invitation: (n: Names) => string; closing: string }>;

const COPY: Record<InviteLanguage, Copy> = {
  english: {
    traditional: {
      title: 'Shubh Vivah',
      invitation: (n) => n.parents
        ? `With the blessings of our elders, ${n.parents} request the honour of your presence, with your family, at the wedding of their children ${n.a} and ${n.b}.`
        : `With the blessings of our elders, we, ${n.a} and ${n.b}, request the honour of your presence, with your family, at our wedding.`,
      closing: 'Your presence and blessings will make our celebration complete.',
    },
    modern: {
      title: "We're getting married",
      invitation: (n) => `${n.a} & ${n.b} would love for you to be there as they begin their forever. Come celebrate with us, and bring the family.`,
      closing: 'Come for the pheras, stay for the dance floor.',
    },
    fun: {
      title: 'Shaadi is happening!',
      invitation: (n) => `After years of "so when are you two getting married?", the answer is finally yes! ${n.a} & ${n.b} are tying the knot, and the baraat cannot start without you.`,
      closing: 'Bring your dancing shoes and an appetite. The chaat counter opens early.',
    },
  },
  hindi: {
    traditional: {
      title: 'शुभ विवाह',
      invitation: (n) => n.parents
        ? `पूज्य बड़ों के आशीर्वाद से, ${n.parents} अपने बच्चों ${n.a} एवं ${n.b} के शुभ विवाह के पावन अवसर पर आपको सपरिवार सादर आमंत्रित करते हैं।`
        : `पूज्य बड़ों के आशीर्वाद से, हम ${n.a} एवं ${n.b} अपने शुभ विवाह के पावन अवसर पर आपको सपरिवार सादर आमंत्रित करते हैं।`,
      closing: 'आपकी उपस्थिति एवं आशीर्वाद हमारे लिए अनमोल हैं।',
    },
    modern: {
      title: 'हम शादी कर रहे हैं',
      invitation: (n) => `${n.a} और ${n.b} अपनी नई ज़िंदगी की शुरुआत आपके साथ मनाना चाहते हैं। आप सपरिवार ज़रूर पधारें।`,
      closing: 'आपके बिना यह जश्न अधूरा है।',
    },
    fun: {
      title: 'शादी पक्की है!',
      invitation: (n) => `आख़िरकार! ${n.a} और ${n.b} की शादी है, और आपके ठुमकों के बिना बारात नहीं निकलेगी।`,
      closing: 'खाना, नाच-गाना और ढेर सारी मस्ती: सब तैयार है!',
    },
  },
  gujarati: {
    traditional: {
      title: 'શુભ લગ્ન',
      invitation: (n) => n.parents
        ? `વડીલોના આશીર્વાદથી, ${n.parents} તેમના સંતાનો ${n.a} અને ${n.b}ના શુભ લગ્ન પ્રસંગે આપને સહપરિવાર પધારવા ભાવભર્યું આમંત્રણ પાઠવે છે.`
        : `વડીલોના આશીર્વાદથી, અમે ${n.a} અને ${n.b} અમારા શુભ લગ્ન પ્રસંગે આપને સહપરિવાર પધારવા ભાવભર્યું આમંત્રણ પાઠવીએ છીએ.`,
      closing: 'આપની હાજરી અને આશીર્વાદ અમારા માટે અમૂલ્ય છે.',
    },
    modern: {
      title: 'અમે લગ્ન કરી રહ્યાં છીએ',
      invitation: (n) => `${n.a} અને ${n.b} તેમના નવા જીવનની શરૂઆત આપની સાથે ઉજવવા માંગે છે. આપ સહપરિવાર જરૂર પધારશો.`,
      closing: 'આપના વગર આ ઉજવણી અધૂરી છે.',
    },
    fun: {
      title: 'લગ્ન નક્કી છે!',
      invitation: (n) => `છેવટે! ${n.a} અને ${n.b}ના લગ્ન છે, અને તમારા ગરબા વગર ઉજવણી અધૂરી છે.`,
      closing: 'જમણ, ગરબા અને ઘણી બધી મસ્તી: બધું તૈયાર છે!',
    },
  },
  hinglish: {
    traditional: {
      title: 'Shubh Vivah',
      invitation: (n) => n.parents
        ? `Bado ke aashirwad se, ${n.parents} apne bachchon ${n.a} aur ${n.b} ki shaadi ke shubh avsar par aapko sapariwar aamantrit karte hain.`
        : `Bado ke aashirwad se, hum ${n.a} aur ${n.b} apni shaadi ke shubh avsar par aapko sapariwar aamantrit karte hain.`,
      closing: 'Aapki upasthiti aur aashirwad hi humara sabse bada tohfa hai.',
    },
    modern: {
      title: 'Hum shaadi kar rahe hain!',
      invitation: (n) => `${n.a} aur ${n.b} apni nayi zindagi ki shuruaat aap sab ke saath celebrate karna chahte hain. Sapariwar zaroor aaiye!`,
      closing: 'Aapke bina yeh jashn adhoora hai.',
    },
    fun: {
      title: 'Shaadi pakki hai!',
      invitation: (n) => `Finally! ${n.a} aur ${n.b} ki shaadi ho rahi hai, aur aapke thumkon ke bina baraat nahi niklegi.`,
      closing: 'Khaana, gaana, naachna: sab ready hai. Bas aap aa jaiye!',
    },
  },
};

const AND: Record<InviteLanguage, string> = { english: 'and', hindi: 'एवं', gujarati: 'તથા', hinglish: 'aur' };

/** Offline invite text in four languages and three tones, used by Demo mode and as the AI fallback. */
export function draftInviteText(w: Wedding, language: InviteLanguage, tone: InviteTone, template: InviteTemplate): InviteText {
  const parents = [w.families?.bride, w.families?.groom].map((p) => p?.trim()).filter(Boolean).join(` ${AND[language]} `);
  const names: Names = { a: firstName(w.partner1), b: firstName(w.partner2), parents };
  const copy = COPY[language][tone];
  const ganesh = templateMeta(template).invocation && tone !== 'fun';
  return {
    invocation: ganesh ? INVOCATION[language].ganesh : INVOCATION[language].plain,
    shlok: SHLOK[language],
    title: copy.title,
    invitation: copy.invitation(names),
    closing: copy.closing,
  };
}

export function defaultInvite(w: Wedding, template: InviteTemplate = 'ganesh', language?: InviteLanguage, tone: InviteTone = 'traditional'): InviteDesign {
  const meta = templateMeta(template);
  const lang = language ?? meta.defaultLanguage;
  return {
    template,
    palette: { ...meta.palette },
    language: lang,
    tone,
    showShlok: meta.invocation,
    text: draftInviteText(w, lang, tone, template),
    grandparents: {},
    swagatotsuk: '',
    darshanabhilashi: '',
    coverPhoto: w.gallery?.[0]?.url ?? w.cover.imageUrl ?? '',
    aiBackground: false,
    updatedAt: Date.now(),
  };
}

// ---------- labels on the pages ----------

export interface InviteLabels {
  dear: string;
  family: string;
  blessings: string;
  brideSide: string;
  groomSide: string;
  swagatotsuk: string;
  darshanabhilashi: string;
  functions: string;
  rsvp: string;
  shagun: string;
  venue: string;
  dress: string;
  scan: string;
}

export const LABELS: Record<InviteLanguage, InviteLabels> = {
  english: { dear: 'Dear', family: 'Our families', blessings: 'With the blessings of', brideSide: "Bride's family", groomSide: "Groom's family", swagatotsuk: 'Eager to welcome you', darshanabhilashi: 'Longing to see you', functions: 'Celebrations', rsvp: 'Kindly RSVP', shagun: 'Bless with shagun', venue: 'Venue map', dress: 'Dress code', scan: 'Scan with your phone camera' },
  hinglish: { dear: 'Dear', family: 'Humara parivaar', blessings: 'Aashirwad', brideSide: 'Ladki wale', groomSide: 'Ladke wale', swagatotsuk: 'Swagatotsuk', darshanabhilashi: 'Darshanabhilashi', functions: 'Karyakram', rsvp: 'RSVP zaroor karein', shagun: 'Shagun dein', venue: 'Venue map', dress: 'Dress code', scan: 'Phone camera se scan karein' },
  hindi: { dear: 'प्रिय', family: 'परिवार', blessings: 'आशीर्वाद', brideSide: 'कन्या पक्ष', groomSide: 'वर पक्ष', swagatotsuk: 'स्वागतोत्सुक', darshanabhilashi: 'दर्शनाभिलाषी', functions: 'मांगलिक कार्यक्रम', rsvp: 'कृपया उत्तर दें', shagun: 'शगुन दें', venue: 'स्थान का नक्शा', dress: 'परिधान', scan: 'फ़ोन कैमरे से स्कैन करें' },
  gujarati: { dear: 'સ્નેહી', family: 'પરિવાર', blessings: 'આશીર્વાદ', brideSide: 'કન્યા પક્ષ', groomSide: 'વર પક્ષ', swagatotsuk: 'સ્વાગતોત્સુક', darshanabhilashi: 'દર્શનાભિલાષી', functions: 'માંગલિક પ્રસંગો', rsvp: 'કૃપા કરી જવાબ આપશો', shagun: 'શગુન આપો', venue: 'સ્થળનો નકશો', dress: 'પહેરવેશ', scan: 'ફોન કેમેરાથી સ્કેન કરો' },
};

const EVENT_NAMES: Record<'hindi' | 'gujarati', Record<EventKind, string>> = {
  hindi: { haldi: 'हल्दी', mehndi: 'मेहंदी', sangeet: 'संगीत संध्या', wedding: 'शुभ विवाह', reception: 'स्वागत समारोह', custom: 'कार्यक्रम' },
  gujarati: { haldi: 'પીઠી', mehndi: 'મહેંદી', sangeet: 'સંગીત સંધ્યા', wedding: 'શુભ લગ્ન', reception: 'સ્વાગત સમારોહ', custom: 'પ્રસંગ' },
};

/** The function's name in the invite language (custom names the couple typed are kept). */
export function localEventName(e: WeddingEvent, language: InviteLanguage): string {
  const name = eventName(e);
  if (language !== 'hindi' && language !== 'gujarati') return name;
  const isDefault = !e.name || /^(haldi|mehndi|sangeet|wedding|reception|wedding & pheras)$/i.test(e.name.trim());
  return isDefault ? EVENT_NAMES[language][e.kind] : name;
}

const LOCALE: Record<InviteLanguage, string> = { english: 'en-IN', hinglish: 'en-IN', hindi: 'hi-IN', gujarati: 'gu-IN' };

export function localDate(iso: string, language: InviteLanguage): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  return new Intl.DateTimeFormat(LOCALE[language], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}

export function localTime(time: string, language: InviteLanguage): string {
  const m = /^(\d{2}):(\d{2})$/.exec(time ?? '');
  if (!m) return time ?? '';
  return new Intl.DateTimeFormat(LOCALE[language], { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, 0, 1, +m[1], +m[2])));
}

// ---------- pages ----------

export type InvitePage =
  | { kind: 'cover' }
  | { kind: 'invitation' }
  | { kind: 'families' }
  | { kind: 'events'; events: WeddingEvent[]; part: number; parts: number }
  | { kind: 'final' };

const EVENTS_PER_PAGE = 3;

/** Cover, invitation, families (when there is something to show), functions three per page, and the RSVP / shagun page. */
export function invitePages(w: Wedding, design: InviteDesign): InvitePage[] {
  const pages: InvitePage[] = [{ kind: 'cover' }, { kind: 'invitation' }];
  const hasFamilies = !!(w.families?.bride || w.families?.groom || design.grandparents.bride || design.grandparents.groom || design.swagatotsuk.trim() || design.darshanabhilashi.trim());
  if (hasFamilies) pages.push({ kind: 'families' });
  const events = sortEvents(w.events);
  const parts = Math.ceil(events.length / EVENTS_PER_PAGE);
  for (let i = 0; i < parts; i++) pages.push({ kind: 'events', events: events.slice(i * EVENTS_PER_PAGE, (i + 1) * EVENTS_PER_PAGE), part: i + 1, parts });
  pages.push({ kind: 'final' });
  return pages;
}

export function nameList(text: string): string[] {
  return (text ?? '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean).slice(0, 24);
}

// ---------- AI design picks (offline rules, also the fallback for real models) ----------

export interface DesignPick {
  template: InviteTemplate;
  palette: InvitePalette;
  language: InviteLanguage;
  tone: InviteTone;
  reason: string;
}

const RULES: [RegExp, InviteTemplate, string][] = [
  [/\bphoto|save the date|poster|cinematic|pre-?wedding|\bfilm\b/i, 'photo', 'A photo-first save-the-date puts the two of you up front, like a film poster.'],
  [/mehndi|mehendi|\bhenna\b|\bboho\b|bohemian|hand-?drawn/i, 'mehndi', 'Henna line-art feels personal and hand-made.'],
  [/floral|flower|pastel|watercolou?r|\bblush\b|\broses?\b|\bspring\b|garden/i, 'floral', 'Soft pastel florals suit a garden or day wedding.'],
  [/punjab|amritsar|ludhiana|jalandhar|patiala|chandigarh|mohali|bhangra|dhol|phulkari|sardar|\bkaur\b/i, 'phulkari', 'A Punjabi celebration deserves phulkari colours and a dhol.'],
  [/gujarat|ahmedabad|surat|vadodara|baroda|rajkot|garba|patel|shah|mehta|desai|bhavnagar/i, 'gujarati', 'Gujarati family names or city: a bandhani kankotri feels like home.'],
  [/udaipur|jaipur|jodhpur|rajasthan|jaisalmer|bikaner|palace|haveli|fort|marwar/i, 'rajasthani', 'A Rajasthan palace venue suits a jharokha doorway and marigolds.'],
  [/chennai|madurai|bengaluru|bangalore|kerala|kochi|hyderabad|tamil|iyer|iyengar|reddy|nair|menon|pillai|rao|temple|mandapam/i, 'south', 'A South Indian wedding: temple gopuram, banana leaves and kolam.'],
  [/beach|goa|minimal|modern|court|registry|intimate|brunch/i, 'minimal', 'An intimate or modern celebration suits a clean, minimal invite.'],
  [/royal|grand|regal|taj|leela|oberoi|ballroom|black tie/i, 'royal', 'A grand venue suits a maroon scroll with your gold crest.'],
];

export function designPicks(w: Wedding, wishes = ''): DesignPick {
  const haystack = [wishes, w.city, w.venue, w.partner1, w.partner2, ...(w.events ?? []).map((e) => `${e.venue} ${e.dressCode ?? ''}`)].join(' ');
  // What the couple asked for wins over what their city or venue suggests.
  const hit = (wishes.trim() ? RULES.find(([re]) => re.test(wishes)) : undefined) ?? RULES.find(([re]) => re.test(haystack));
  const template = hit?.[1] ?? 'ganesh';
  const meta = templateMeta(template);
  const tone: InviteTone = /fun|playful|quirky|masti/i.test(wishes) ? 'fun' : /modern|minimal|simple/i.test(wishes) ? 'modern' : 'traditional';
  const language: InviteLanguage = /gujarati/i.test(wishes) ? 'gujarati' : /hindi/i.test(wishes) ? 'hindi' : /hinglish/i.test(wishes) ? 'hinglish' : /english/i.test(wishes) ? 'english' : meta.defaultLanguage;
  return { template, palette: { ...meta.palette }, language, tone, reason: hit?.[2] ?? 'A classic Ganesh kankotri in kumkum red and gold suits most families.' };
}
