/** Domain model. Amounts are whole rupees (UPI shagun is never fractional). */

export const COVER_PRESETS = ['marigold', 'maroon', 'rose', 'peacock'] as const;
export type CoverPreset = (typeof COVER_PRESETS)[number];

export interface Goal {
  id: string;
  title: string;
  /** Target in rupees. */
  target: number;
  emoji: string;
  /** Optional small photo as a data URL (kept small so localStorage does not fill up). */
  imageUrl?: string;
  description?: string;
}

export interface Wedding {
  id: string;
  slug: string;
  partner1: string;
  partner2: string;
  /** YYYY-MM-DD */
  date: string;
  venue: string;
  city: string;
  cover: { preset: CoverPreset; imageUrl?: string };
  story: string;
  goals: Goal[];
  /** UPI VPA the money goes to, e.g. riya.arjun@okhdfcbank */
  upiId: string;
  payeeName: string;
  /** Show contribution amounts on the public blessing wall. Off by default: shagun is personal. */
  showAmounts: boolean;
  createdAt: number;
  /** Seeded sample wedding (shown with a banner). */
  demo?: boolean;
  /** Opened from a share link on a guest's device, not created in this browser. */
  imported?: boolean;
}

export type ContributionStatus = 'guest-confirmed' | 'verified';

export interface Contribution {
  id: string;
  weddingId: string;
  goalId: string;
  guestName: string;
  amount: number;
  message: string;
  /** Optional, so the couple can send a WhatsApp thank-you. Digits only, with country code. */
  phone?: string;
  createdAt: number;
  /** The guest tapped "I've paid"; the couple marks it verified after checking their bank app. */
  status: ContributionStatus;
  thankedAt?: number;
}

export type NewContribution = Omit<Contribution, 'id' | 'createdAt' | 'status' | 'thankedAt'>;

export const MIN_GOALS = 2;
export const MAX_GOALS = 5;
/** NPCI's per-transaction cap for person-to-person UPI payments. */
export const MAX_UPI_AMOUNT = 100_000;
/** Shagun amounts traditionally end in 1. */
export const SHAGUN_CHIPS = [501, 1100, 2100, 5100];

export type NoteLanguage = 'english' | 'hindi' | 'hinglish';
export const NOTE_LANGUAGES: { id: NoteLanguage; label: string }[] = [
  { id: 'english', label: 'English' },
  { id: 'hindi', label: 'हिन्दी' },
  { id: 'hinglish', label: 'Hinglish' },
];

export interface GoalProgress {
  goal: Goal;
  raised: number;
  verified: number;
  count: number;
  /** 0..100, capped. */
  percent: number;
  funded: boolean;
}

export interface WeddingTotals {
  raised: number;
  verified: number;
  target: number;
  contributors: number;
  percent: number;
  goals: GoalProgress[];
}
