import { daysUntil, formatInr } from './format';
import { guestStatus } from './guests';
import { Contribution, Guest, Rsvp, Side, Wedding } from './models';

const DAY = 86_400_000;

export interface DayPoint {
  /** Local midnight of the day, ms. */
  day: number;
  /** Given that day. */
  amount: number;
  /** Running total up to and including the day. */
  total: number;
}

const midnight = (ms: number) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** Shagun per day and the running total, over the last `days` days (earlier money counts in the start). */
export function cumulativeByDay(contributions: readonly Contribution[], days = 30, now = Date.now()): DayPoint[] {
  const end = midnight(now);
  const start = end - (days - 1) * DAY;
  let total = contributions.filter((c) => c.createdAt < start).reduce((t, c) => t + c.amount, 0);
  const byDay = new Map<number, number>();
  for (const c of contributions) {
    if (c.createdAt >= start) byDay.set(midnight(c.createdAt), (byDay.get(midnight(c.createdAt)) ?? 0) + c.amount);
  }
  const out: DayPoint[] = [];
  for (let day = start; day <= end; day = midnight(day + DAY + 3_600_000)) {
    const amount = byDay.get(day) ?? 0;
    total += amount;
    out.push({ day, amount, total });
  }
  return out;
}

export interface SideSplit {
  side: Side | 'none';
  amount: number;
  count: number;
  percent: number;
}

export function splitBySide(contributions: readonly Contribution[]): SideSplit[] {
  const total = contributions.reduce((t, c) => t + c.amount, 0);
  return (['bride', 'groom', 'none'] as const).map((side) => {
    const mine = contributions.filter((c) => (c.side ?? 'none') === side);
    const amount = mine.reduce((t, c) => t + c.amount, 0);
    return { side, amount, count: mine.length, percent: total ? Math.round((amount / total) * 100) : 0 };
  });
}

export interface InviteStats {
  total: number;
  sent: number;
  opened: number;
  rsvp: number;
  gave: number;
}

/** Funnel counts are cumulative: a guest who gave shagun has also been sent and opened the invite. */
export function inviteStats(guests: readonly Guest[]): InviteStats {
  const rank = { 'not-sent': 0, sent: 1, opened: 2, rsvp: 3, gave: 4 } as const;
  const s = { total: guests.length, sent: 0, opened: 0, rsvp: 0, gave: 0 };
  for (const g of guests) {
    const r = rank[guestStatus(g)];
    if (r >= 1) s.sent++;
    if (r >= 2) s.opened++;
    if (r >= 3) s.rsvp++;
    if (r >= 4) s.gave++;
  }
  return s;
}

export type ActivityKind = 'shagun' | 'rsvp' | 'opened';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  at: number;
  who: string;
  text: string;
}

/** Newest first: shagun, RSVPs and invite opens merged into one feed. */
export function activityFeed(w: Wedding, contributions: readonly Contribution[], rsvps: readonly Rsvp[], guests: readonly Guest[], limit = 8): ActivityItem[] {
  const goal = new Map(w.goals.map((g) => [g.id, g.title]));
  const items: ActivityItem[] = [
    ...contributions.map((c): ActivityItem => ({ id: `c${c.id}`, kind: 'shagun', at: c.createdAt, who: c.guestName, text: `gave ${formatInr(c.amount)} towards ${goal.get(c.goalId) ?? 'a dream'}` })),
    ...rsvps.map((r): ActivityItem => ({
      id: `r${r.id}`, kind: 'rsvp', at: r.createdAt, who: r.guestName,
      text: r.eventIds.length ? `is coming${r.partySize > 1 ? ` with ${r.partySize - 1} more` : ''}` : 'sent regrets',
    })),
    ...guests.filter((g) => g.openedAt).map((g): ActivityItem => ({ id: `o${g.id}`, kind: 'opened', at: g.openedAt!, who: g.greeting || g.name, text: 'opened your invitation' })),
  ];
  return items.sort((a, b) => b.at - a.at).slice(0, limit);
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  detail: string;
  link: string[];
}

export const CARD_PRINTED_KEY = (weddingId: string) => `sg.cardPrinted.${weddingId}`;

/** The couple's to-do list, derived from their data (only the venue card needs a stored tick). */
export function weddingChecklist(w: Wedding, contributions: readonly Contribution[], rsvps: readonly Rsvp[], guests: readonly Guest[], cardPrinted: boolean): ChecklistItem[] {
  const s = inviteStats(guests);
  const thanked = contributions.filter((c) => c.thankedAt).length;
  const verified = contributions.filter((c) => c.status === 'verified').length;
  const base = ['/w', w.slug];
  return [
    { id: 'page', label: 'Wedding page with your dreams', done: w.goals.length >= 2, detail: `${w.goals.length} dreams`, link: [...base, 'edit'] },
    { id: 'functions', label: 'Functions and venues added', done: (w.events?.length ?? 0) > 0, detail: `${w.events?.length ?? 0} functions`, link: [...base, 'edit'] },
    { id: 'invite', label: 'E-invite designed', done: !!w.invite, detail: w.invite ? 'Ready to send' : 'Pick a style', link: [...base, 'invite'] },
    { id: 'sent', label: 'Invites sent to guests', done: s.total > 0 && s.sent === s.total, detail: `${s.sent} of ${s.total} sent`, link: [...base, 'guests'] },
    { id: 'card', label: 'Venue QR card printed', done: cardPrinted, detail: cardPrinted ? 'Printed' : 'For the shagun table', link: [...base, 'card'] },
    { id: 'rsvps', label: 'RSVPs coming in', done: rsvps.length > 0, detail: `${rsvps.length} replies`, link: [...base, 'dashboard'] },
    { id: 'verify', label: 'Shagun checked in your bank app', done: contributions.length > 0 && verified === contributions.length, detail: `${verified} of ${contributions.length} verified`, link: [...base, 'dashboard'] },
    { id: 'thanks', label: 'Thank-you notes sent', done: contributions.length > 0 && thanked === contributions.length, detail: `${thanked} of ${contributions.length} thanked`, link: [...base, 'dashboard'] },
  ];
}

export function daysToGo(w: Wedding, now = new Date()): number {
  return daysUntil(w.date, now);
}
