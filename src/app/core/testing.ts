import { Contribution, Goal, Wedding } from './models';

/** Small fixtures shared by the unit tests. */

export function goal(id: string, target: number, patch: Partial<Goal> = {}): Goal {
  return { id, title: `Goal ${id}`, target, emoji: '🎁', ...patch };
}

export function wedding(patch: Partial<Wedding> = {}): Wedding {
  return {
    id: 'w1',
    slug: 'asha-weds-dev',
    partner1: 'Asha Rao',
    partner2: 'Dev Khanna',
    date: '2026-12-12',
    venue: 'Taj Lands End',
    city: 'Mumbai',
    cover: { preset: 'rose' },
    story: 'We met at work.',
    goals: [goal('g1', 300000, { title: 'Honeymoon' }), goal('g2', 50000, { title: 'Trees' })],
    upiId: 'asha.dev@okaxis',
    payeeName: 'Asha Rao',
    showAmounts: false,
    createdAt: 1,
    ...patch,
  };
}

let n = 0;
export function contribution(goalId: string, amount: number, patch: Partial<Contribution> = {}): Contribution {
  return {
    id: `c${++n}`,
    weddingId: 'w1',
    goalId,
    guestName: `Guest ${n}`,
    amount,
    message: '',
    createdAt: 1000 + n,
    status: 'guest-confirmed',
    ...patch,
  };
}
