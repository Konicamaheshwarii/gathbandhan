import { formatDate, formatInrShort } from './format';
import { Wedding } from './models';

/** Indian mobile numbers: 10 digits starting 6-9, optionally with +91 / 91 / 0. Returns 91XXXXXXXXXX. */
export function normalizeIndianPhone(input: string): string | null {
  const digits = (input ?? '').replace(/\D/g, '');
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2)
    : digits.length === 11 && digits.startsWith('0') ? digits.slice(1)
    : digits;
  return /^[6-9]\d{9}$/.test(local) ? `91${local}` : null;
}

/** wa.me link; with a phone it opens that chat, without one WhatsApp asks whom to send to. */
export function whatsappUrl(text: string, phone?: string | null): string {
  return `https://wa.me/${phone ?? ''}?text=${encodeURIComponent(text)}`;
}

export function inviteMessage(w: Wedding, url: string, totalTarget: number): string {
  const goals = w.goals.slice(0, 3).map((g) => `${g.emoji} ${g.title}`).join('\n');
  return [
    `💍 ${w.partner1} & ${w.partner2} are getting married on ${formatDate(w.date)}!`,
    '',
    'Instead of gifts, you can bless us with shagun towards the dreams we are starting our life with:',
    goals,
    '',
    `Give any amount by UPI, straight to us (goals add up to ${formatInrShort(totalTarget)}). Your blessings matter more than the amount 🙏`,
    url,
  ].join('\n');
}
