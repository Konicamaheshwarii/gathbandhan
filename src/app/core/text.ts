/**
 * Text helpers that never split a character. JavaScript strings are UTF-16, so `slice` can cut an
 * emoji (a surrogate pair, or a ZWJ sequence such as 👨‍👩‍👧) in half, which shows up as "�" once
 * the text is copied or put in a URL. Everything that shortens user-visible text goes through here.
 */

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

/** The text as user-perceived characters (grapheme clusters). */
export function graphemes(text: string): string[] {
  const s = text ?? '';
  if (segmenter) return [...segmenter.segment(s)].map((g) => g.segment);
  return Array.from(s); // code points: still never splits a surrogate pair
}

/** At most `max` characters, cut on a grapheme boundary. */
export function truncateText(text: string, max: number, ellipsis = ''): string {
  const parts = graphemes(text ?? '');
  if (parts.length <= max) return text ?? '';
  return parts.slice(0, Math.max(0, max - (ellipsis ? 1 : 0))).join('').trimEnd() + ellipsis;
}

/** Removes lone surrogates (which would become "�") without touching valid emoji. */
export function wellFormed(text: string): string {
  return (text ?? '').replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
}

/** True when the text has a replacement character or a lone surrogate. */
export function hasBrokenCharacters(text: string): boolean {
  return /�/.test(text) || wellFormed(text) !== text;
}

/**
 * Capitalises Latin words typed oddly ("konica" → "Konica", "UDaipur" → "Udaipur", "DELHI" →
 * "Delhi"), for display only. Other scripts, short acronyms (IIT, NRI) and names with deliberate
 * inner capitals (McDonald, DeSouza) are kept as written.
 */
export function tidyCase(text: string): string {
  // All in capitals ("NEW DELHI") means caps lock, not acronyms.
  const shouting = !/[a-z]/.test(text ?? '');
  return (text ?? '').replace(/[A-Za-z][A-Za-z']*/g, (word) => {
    if (!shouting && /^[A-Z]{2,3}$/.test(word)) return word;
    if (/^(Mc|Mac|De|Di|Da|La|Le|O')[A-Z][a-z]+$/.test(word)) return word;
    if (/^[a-z]{1,3}$/.test(word) && /^(and|of|the|ji|da|de|ka|ki|ke)$/.test(word)) return word;
    return word[0].toUpperCase() + word.slice(1).toLowerCase();
  });
}
