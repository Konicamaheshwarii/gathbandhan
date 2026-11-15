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
  /** Short news from the couple guests see on the goal ("Honeymoon booked!"). Newest first. */
  updates?: GoalUpdate[];
}

export interface GoalUpdate {
  id: string;
  text: string;
  imageUrl?: string;
  createdAt: number;
}

export const EVENT_KINDS = ['haldi', 'mehndi', 'sangeet', 'wedding', 'reception', 'custom'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];
export const EVENT_META: Record<EventKind, { label: string; emoji: string }> = {
  haldi: { label: 'Haldi', emoji: '🌼' },
  mehndi: { label: 'Mehndi', emoji: '🌿' },
  sangeet: { label: 'Sangeet', emoji: '🎶' },
  wedding: { label: 'Wedding', emoji: '🔥' },
  reception: { label: 'Reception', emoji: '🥂' },
  custom: { label: 'Function', emoji: '✨' },
};

/** One function of the wedding (haldi, mehndi, sangeet…). Times are local Indian time (IST). */
export interface WeddingEvent {
  id: string;
  kind: EventKind;
  /** Display name, e.g. "Mehndi & Ladies Sangeet". Defaults to the kind's label. */
  name: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm, 24-hour. */
  time: string;
  /** HH:mm; when empty the calendar entry lasts three hours. */
  endTime?: string;
  venue: string;
  address?: string;
  mapsUrl?: string;
  dressCode?: string;
}

/** "With blessings from…": parents' names as the couple wants them printed. */
export interface Families {
  bride?: string;
  groom?: string;
}

export type Side = 'bride' | 'groom';
export const SIDES: { id: Side; label: string }[] = [
  { id: 'bride', label: "Bride's side" },
  { id: 'groom', label: "Groom's side" },
];

export interface GalleryPhoto {
  id: string;
  /** Storage URL (backend) or a compressed data URL (demo mode). */
  url: string;
  caption?: string;
}

/** One moment of "our story" (how we met, the proposal…). */
export interface Milestone {
  id: string;
  /** Free text such as "March 2019" or "Diwali 2023". */
  when: string;
  title: string;
  text: string;
  emoji: string;
}

export const MAX_EVENTS = 8;
export const MAX_PHOTOS = 6;
export const MAX_MILESTONES = 6;
export const MAX_GOAL_UPDATES = 5;

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
  events?: WeddingEvent[];
  families?: Families;
  gallery?: GalleryPhoto[];
  milestones?: Milestone[];
  invite?: InviteDesign;
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
  side?: Side;
  createdAt: number;
  /** The guest tapped "I've paid"; the couple marks it verified after checking their bank app. */
  status: ContributionStatus;
  thankedAt?: number;
}

export type NewContribution = Omit<Contribution, 'id' | 'createdAt' | 'status' | 'thankedAt'>;

/** What anyone may see of a contribution: never the phone, and the amount only when the couple shows amounts. */
export interface WallEntry {
  id: string;
  goalId: string;
  guestName: string;
  message: string;
  amount?: number;
  side?: Side;
  createdAt: number;
}

/** Public, non-sensitive view of a wedding's shagun: totals per goal and the blessing wall. */
export interface PublicActivity {
  goals: Record<string, { raised: number; count: number }>;
  raised: number;
  contributors: number;
  wall: WallEntry[];
}

export interface Rsvp {
  id: string;
  weddingId: string;
  guestName: string;
  phone?: string;
  side?: Side;
  /** Events the guest will attend. */
  eventIds: string[];
  /** People in the party, including the guest. */
  partySize: number;
  note: string;
  createdAt: number;
}

export type NewRsvp = Omit<Rsvp, 'id' | 'createdAt'>;
export const MAX_PARTY = 20;
export const NOTE_MAX = 280;

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

// ---------- e-invite (digital kankotri) ----------

/** Saved designs keep these ids; the four newest styles were added after the first six. */
export const INVITE_TEMPLATES = ['ganesh', 'rajasthani', 'gujarati', 'south', 'royal', 'minimal', 'floral', 'mehndi', 'photo', 'phulkari'] as const;
export type InviteTemplate = (typeof INVITE_TEMPLATES)[number];

export type InviteLanguage = 'english' | 'hindi' | 'gujarati' | 'hinglish';
export const INVITE_LANGUAGES: { id: InviteLanguage; label: string }[] = [
  { id: 'english', label: 'English' },
  { id: 'hindi', label: 'हिन्दी' },
  { id: 'gujarati', label: 'ગુજરાતી' },
  { id: 'hinglish', label: 'Hinglish' },
];

export type InviteTone = 'traditional' | 'modern' | 'fun';
export const INVITE_TONES: InviteTone[] = ['traditional', 'modern', 'fun'];

export interface InvitePalette {
  /** Main ink and borders. */
  primary: string;
  /** Gold / highlight. */
  accent: string;
  /** Page background. */
  paper: string;
}

/** The words on the invite. AI drafts them; the couple can edit every line. */
export interface InviteText {
  /** "॥ श्री गणेशाय नमः ॥" or "Together with their families". */
  invocation: string;
  /** Optional shlok under the deity motif. */
  shlok: string;
  /** "Shubh Vivah" / "शुभ विवाह". */
  title: string;
  /** "With the blessings of… we cordially invite you and your family…". */
  invitation: string;
  /** Closing line on the last page. */
  closing: string;
}

export interface InviteDesign {
  template: InviteTemplate;
  palette: InvitePalette;
  language: InviteLanguage;
  tone: InviteTone;
  showShlok: boolean;
  text: InviteText;
  grandparents: { bride?: string; groom?: string };
  /** Family names printed under "Swagatotsuk" (eager to welcome you), one per line. */
  swagatotsuk: string;
  /** Under "Darshanabhilashi" (longing to see you), one per line. */
  darshanabhilashi: string;
  /** Photo shown on the cover (from the gallery or the page cover); empty for the motif only. */
  coverPhoto?: string;
  /** Decorative background from the free Pollinations image service. Off by default. */
  aiBackground: boolean;
  updatedAt: number;
}

export interface Guest {
  id: string;
  weddingId: string;
  name: string;
  /** How the invite addresses them: "Sharma Parivar", "Sunita Mausi & family". */
  greeting?: string;
  phone?: string;
  side?: Side;
  /** "Mama's family", "Office", "College friends". */
  group?: string;
  /** Secret part of their personal invite link. */
  token: string;
  sentAt?: number;
  openedAt?: number;
  rsvpAt?: number;
  gaveAt?: number;
  createdAt: number;
}

export type GuestStatus = 'not-sent' | 'sent' | 'opened' | 'rsvp' | 'gave';
export const GUEST_STATUS: { id: GuestStatus; label: string }[] = [
  { id: 'not-sent', label: 'Not sent' },
  { id: 'sent', label: 'Sent' },
  { id: 'opened', label: 'Opened' },
  { id: 'rsvp', label: "RSVP'd" },
  { id: 'gave', label: 'Gave shagun' },
];
export type GuestMark = 'opened' | 'rsvp' | 'gave';

/** What a personal invite link reveals: only that guest's own greeting. */
export interface GuestInvite {
  name: string;
  greeting: string;
}
export const MAX_GUESTS = 1000;
