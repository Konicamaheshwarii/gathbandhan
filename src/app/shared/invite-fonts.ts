import { InviteLanguage } from '../core/models';

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

const loaded = new Set<string>();

export function ensureInviteFonts(language: InviteLanguage, doc: Document = document): Promise<void> {
  const css = INVITE_FONTS[language].css;
  if (!css || loaded.has(css)) return doc.fonts?.ready.then(() => undefined) ?? Promise.resolve();
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
