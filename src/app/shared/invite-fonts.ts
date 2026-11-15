import { InviteLanguage, InviteTemplate } from '../core/models';

/**
 * Display and body fonts per invite language. Hindi uses Tiro Devanagari Hindi (a book face made
 * for Devanagari) and Gujarati uses Rasa and Mukta Vaani. Google Fonts serves them split by
 * unicode-range, so a phone only downloads the script it shows. Loaded only on invite pages.
 */
export const INVITE_FONTS: Record<InviteLanguage, { display: string; body: string; css?: string }> = {
  english: { display: "'Fraunces', Georgia, serif", body: "'Mukta', system-ui, sans-serif" },
  hinglish: { display: "'Fraunces', Georgia, serif", body: "'Mukta', system-ui, sans-serif" },
  hindi: { display: "'Tiro Devanagari Hindi', 'Fraunces', serif", body: "'Mukta', system-ui, sans-serif", css: 'family=Tiro+Devanagari+Hindi:ital@0;1' },
  gujarati: { display: "'Rasa', 'Fraunces', serif", body: "'Mukta Vaani', 'Mukta', system-ui, sans-serif", css: 'family=Rasa:wght@500;600&family=Mukta+Vaani:wght@400;600' },
};

/**
 * Each style's own type pairing, all from Google Fonts. They come first in the font stack and the
 * language fonts above follow, so a Latin-only face (Cinzel, Great Vibes) hands Devanagari and
 * Gujarati glyphs to Tiro or Rasa. Faces that carry Indian scripts (Yatra One, Kalam, Baloo) are
 * used for them too.
 */
export const TEMPLATE_FONTS: Record<InviteTemplate, { display: string; script?: string; body?: string; css: string }> = {
  ganesh: { display: "'Playfair Display'", css: 'family=Playfair+Display:ital,wght@0,500;0,700;1,500' },
  rajasthani: { display: "'Yatra One'", script: "'Yatra One'", css: 'family=Yatra+One' },
  gujarati: { display: "'Rasa'", script: "'Rasa'", css: 'family=Rasa:ital,wght@0,500;0,700;1,500' },
  south: { display: "'Marcellus'", css: 'family=Marcellus' },
  royal: { display: "'Cinzel'", script: "'Cormorant Garamond'", body: "'Cormorant Garamond'", css: 'family=Cinzel:wght@500;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500' },
  minimal: { display: "'Bodoni Moda'", css: 'family=Bodoni+Moda:ital,wght@0,400;0,500;1,400' },
  floral: { display: "'Cormorant Garamond'", script: "'Great Vibes'", body: "'Cormorant Garamond'", css: 'family=Great+Vibes&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500' },
  mehndi: { display: "'Kalam'", script: "'Kalam'", css: 'family=Kalam:wght@400;700' },
  photo: { display: "'Oswald'", css: 'family=Oswald:wght@400;600' },
  phulkari: { display: "'Baloo 2', 'Baloo Bhai 2'", script: "'Baloo 2', 'Baloo Bhai 2'", css: 'family=Baloo+2:wght@600;800&family=Baloo+Bhai+2:wght@600;800' },
};

/** Font stacks for one template in one language. */
export function inviteFontVars(template: InviteTemplate, language: InviteLanguage): { display: string; script: string; body: string } {
  const lang = INVITE_FONTS[language];
  const tpl = TEMPLATE_FONTS[template] ?? TEMPLATE_FONTS.ganesh;
  return {
    display: `${tpl.display}, ${lang.display}`,
    script: `${tpl.script ?? tpl.display}, ${lang.display}`,
    body: tpl.body ? `${tpl.body}, ${lang.body}` : lang.body,
  };
}

const loaded = new Set<string>();

function loadCss(css: string, doc: Document): Promise<void> {
  if (loaded.has(css)) return doc.fonts?.ready.then(() => undefined) ?? Promise.resolve();
  loaded.add(css);
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.crossOrigin = 'anonymous';
  link.href = `https://fonts.googleapis.com/css2?${css}&display=swap`;
  doc.head.appendChild(link);
  return new Promise((resolve) => {
    link.onload = link.onerror = () => resolve();
  });
}

/** Loads the language's fonts and, when given, the template's own pairing. */
export async function ensureInviteFonts(language: InviteLanguage, template?: InviteTemplate, doc: Document = document): Promise<void> {
  const sheets = [INVITE_FONTS[language].css, template ? TEMPLATE_FONTS[template]?.css : undefined].filter((c): c is string => !!c);
  if (!sheets.length) return doc.fonts?.ready.then(() => undefined) ?? Promise.resolve();
  await Promise.all(sheets.map((c) => loadCss(c, doc)));
}

/** Every template's fonts, for pages that show all the styles side by side. */
export function ensureAllTemplateFonts(doc: Document = document): Promise<void> {
  return Promise.all(Object.values(TEMPLATE_FONTS).map((f) => loadCss(f.css, doc))).then(() => undefined);
}
