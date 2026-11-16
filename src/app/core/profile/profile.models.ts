import { InviteLanguage, NoteLanguage, Wedding } from '../models';
import { isValidVpa, normalizeVpa } from '../upi';
import { firstName } from '../util';

/** Who the person is in the wedding. */
export type WeddingRole = 'bride' | 'groom' | 'family' | 'planner' | 'other';
export const WEDDING_ROLES: { id: WeddingRole; label: string; emoji: string }[] = [
  { id: 'bride', label: 'Bride', emoji: '👰' },
  { id: 'groom', label: 'Groom', emoji: '🤵' },
  { id: 'family', label: 'Family', emoji: '👪' },
  { id: 'planner', label: 'Planner', emoji: '📋' },
  { id: 'other', label: 'Other', emoji: '✨' },
];

/** Preferred language, also the default for AI-written text and invites. */
export type ProfileLanguage = 'en' | 'hi' | 'gu' | 'hinglish';
export const PROFILE_LANGUAGES: { id: ProfileLanguage; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'हिन्दी' },
  { id: 'gu', label: 'ગુજરાતી' },
  { id: 'hinglish', label: 'Hinglish' },
];

export interface Profile {
  /** The auth user id. */
  id: string;
  fullName: string;
  displayName: string;
  /** E.164 (+919876543210), or ''. */
  phone: string;
  city: string;
  /** Storage path (avatars/<uid>/<file>) with the backend, '' when there is no photo. */
  avatarPath: string;
  /** What an <img> shows: a public URL (backend) or a data URL (demo mode). '' for none. */
  avatarUrl: string;
  role: WeddingRole | null;
  language: ProfileLanguage;
  /** Reused when creating a wedding page. */
  upiId: string;
  payeeName: string;
  /** Stored for a future email feature; nothing is emailed yet. */
  notifyShagun: boolean;
  notifyRsvp: boolean;
  createdAt: number;
  updatedAt: number;
}

/** What the person can edit. */
export type ProfileInput = Partial<Pick<Profile,
  'fullName' | 'displayName' | 'phone' | 'city' | 'role' | 'language' | 'upiId' | 'payeeName' | 'notifyShagun' | 'notifyRsvp'>>;

export function emptyProfile(id: string): Profile {
  return {
    id, fullName: '', displayName: '', phone: '', city: '', avatarPath: '', avatarUrl: '', role: null, language: 'en',
    upiId: '', payeeName: '', notifyShagun: true, notifyRsvp: true, createdAt: 0, updatedAt: 0,
  };
}

/**
 * Phone numbers as E.164. Ten digits starting 6-9 (with or without 0 / 91) are Indian mobiles;
 * anything else must start with + and a country code. Returns null when it cannot be read.
 */
export function normalizePhone(text: string): string | null {
  const raw = (text ?? '').trim();
  if (!raw) return '';
  const digits = raw.replace(/[^\d]/g, '');
  if (raw.startsWith('+')) return /^[1-9]\d{6,14}$/.test(digits) ? `+${digits}` : null;
  const local = digits.replace(/^(0|91)(?=[6-9]\d{9}$)/, '');
  if (/^[6-9]\d{9}$/.test(local)) return `+91${local}`;
  if (/^00[1-9]\d{6,14}$/.test(digits)) return `+${digits.slice(2)}`;
  return null;
}

/** "+919876543210" -> "+91 98765 43210"; other countries keep a plain "+44 7700900123". */
export function formatPhone(e164: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164 ?? '');
  if (m) return `+91 ${m[1]} ${m[2]}`;
  return e164 ?? '';
}

export type ProfileErrors = Partial<Record<keyof ProfileInput, string>>;

/** Checks and tidies the editable fields. Errors are friendly sentences keyed by field. */
export function cleanProfileInput(input: ProfileInput, opts: { requireName?: boolean } = {}): { value: ProfileInput; errors: ProfileErrors } {
  const value: ProfileInput = { ...input };
  const errors: ProfileErrors = {};
  const trim = (k: 'fullName' | 'displayName' | 'city' | 'payeeName') => {
    if (value[k] !== undefined) value[k] = (value[k] ?? '').trim().replace(/\s+/g, ' ');
  };
  trim('fullName');
  trim('displayName');
  trim('city');
  trim('payeeName');

  if (opts.requireName && !value.fullName) errors.fullName = 'Please add your name.';
  if ((value.fullName ?? '').length > 80) errors.fullName = 'Keep your name under 80 characters.';
  if ((value.displayName ?? '').length > 40) errors.displayName = 'Keep it under 40 characters.';
  if ((value.city ?? '').length > 60) errors.city = 'Keep the city under 60 characters.';
  if (value.phone !== undefined) {
    const phone = normalizePhone(value.phone);
    if (phone === null) errors.phone = 'Enter a 10-digit mobile number, or + and the country code.';
    else value.phone = phone;
  }
  if (value.upiId !== undefined) {
    value.upiId = value.upiId.trim() ? normalizeVpa(value.upiId) : '';
    if (value.upiId && !isValidVpa(value.upiId)) errors.upiId = 'That does not look like a UPI ID (name@bank).';
  }
  if ((value.payeeName ?? '').length > 60) errors.payeeName = 'Keep the name under 60 characters.';
  if (value.role !== undefined && value.role !== null && !WEDDING_ROLES.some((r) => r.id === value.role)) errors.role = 'Pick one of the roles.';
  if (value.language !== undefined && !PROFILE_LANGUAGES.some((l) => l.id === value.language)) errors.language = 'Pick a language.';
  return { value, errors };
}

/** The name to greet with: the display name, else the first name. */
export function greetingName(p: Pick<Profile, 'displayName' | 'fullName'> | null | undefined): string {
  return (p?.displayName?.trim() || firstName(p?.fullName ?? '')).trim();
}

/** "Konica Maheshwari" -> "KM"; falls back to the email's first letter. */
export function initialsOf(name: string, email = ''): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0]?.slice(0, 1) ?? '';
  return (letters || email.trim().slice(0, 1) || '?').toUpperCase();
}

/** The invite language for a profile language. */
export function inviteLanguageOf(lang: ProfileLanguage | undefined | null): InviteLanguage {
  return lang === 'hi' ? 'hindi' : lang === 'gu' ? 'gujarati' : lang === 'hinglish' ? 'hinglish' : 'english';
}

/** AI notes and stories have no Gujarati yet: Gujarati speakers get English. */
export function noteLanguageOf(lang: ProfileLanguage | undefined | null): NoteLanguage {
  return lang === 'hi' ? 'hindi' : lang === 'hinglish' ? 'hinglish' : 'english';
}

/** How complete the profile is, for the header nudge and the account page meter. */
export function profileCompletion(p: Profile | null): { done: number; total: number; missing: string[] } {
  const checks: [string, boolean][] = [
    ['your name', !!p?.fullName],
    ['a photo', !!p?.avatarUrl],
    ['your role', !!p?.role],
    ['your phone', !!p?.phone],
    ['your city', !!p?.city],
    ['a UPI ID', !!p?.upiId],
  ];
  return { done: checks.filter(([, ok]) => ok).length, total: checks.length, missing: checks.filter(([, ok]) => !ok).map(([k]) => k) };
}

/** The account page's "My wedding pages" rows. */
export type WeddingAccess = 'owner' | 'co-owner';
export interface MyWedding {
  wedding: Wedding;
  access: WeddingAccess | 'sample';
}

/** "Download my data": the profile and the wedding pages the person owns, as JSON. */
export function accountExport(user: { id: string; email: string }, profile: Profile | null, weddings: MyWedding[], now = Date.now()): string {
  const { avatarUrl: _url, ...rest } = profile ?? emptyProfile(user.id);
  return JSON.stringify(
    {
      exportedAt: new Date(now).toISOString(),
      app: 'Gathbandhan',
      account: { id: user.id, email: user.email },
      profile: profile ? { ...rest, avatarUrl: profile.avatarUrl.startsWith('data:') ? '(photo kept in this browser)' : profile.avatarUrl } : null,
      weddings: weddings.filter((m) => m.access !== 'sample').map((m) => ({ access: m.access, ...m.wedding })),
    },
    null,
    2,
  );
}

/** "gathbandhan-account-2026-11-16.json" */
export function exportFileName(now = Date.now()): string {
  return `gathbandhan-account-${new Date(now).toISOString().slice(0, 10)}.json`;
}
