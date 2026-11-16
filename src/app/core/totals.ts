import { Contribution, GoalProgress, PublicActivity, Wedding, WeddingTotals, isConfirmed, isCounted } from './models';

const pct = (raised: number, target: number) => (target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0);

/** Contributions to goals that no longer exist are still counted in the wedding total. */
export function computeTotals(wedding: Wedding, all: readonly Contribution[]): WeddingTotals {
  const contributions = all.filter(isCounted);
  const goals: GoalProgress[] = wedding.goals.map((goal) => {
    const mine = contributions.filter((c) => c.goalId === goal.id);
    const raised = sum(mine);
    return {
      goal,
      raised,
      verified: sum(mine.filter(isConfirmed)),
      count: mine.length,
      percent: pct(raised, goal.target),
      funded: goal.target > 0 && raised >= goal.target,
    };
  });
  const raised = sum(contributions);
  const target = wedding.goals.reduce((t, g) => t + g.target, 0);
  return {
    raised,
    verified: sum(contributions.filter(isConfirmed)),
    target,
    contributors: new Set(contributions.map((c) => c.guestName.trim().toLowerCase())).size,
    percent: pct(raised, target),
    goals,
  };
}

function sum(list: readonly Contribution[]): number {
  return list.reduce((t, c) => t + c.amount, 0);
}

/**
 * The public view of a wedding's contributions, the same shape the backend's `public_activity`
 * function returns: totals per goal, and blessings without phone numbers and without amounts
 * unless the couple chose to show them.
 */
export function publicActivity(wedding: Wedding, all: readonly Contribution[]): PublicActivity {
  const contributions = all.filter(isCounted);
  const goals: PublicActivity['goals'] = {};
  for (const c of contributions) {
    const g = (goals[c.goalId] ??= { raised: 0, count: 0 });
    g.raised += c.amount;
    g.count++;
  }
  return {
    goals,
    raised: sum(contributions),
    contributors: new Set(contributions.map((c) => c.guestName.trim().toLowerCase())).size,
    wall: contributions
      .filter((c) => c.message.trim())
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((c) => ({
        id: c.id,
        goalId: c.goalId,
        guestName: c.guestName,
        message: c.message,
        createdAt: c.createdAt,
        ...(c.side ? { side: c.side } : {}),
        ...(wedding.showAmounts ? { amount: c.amount } : {}),
        ...(c.status === 'paid' ? { paid: true } : {}),
      })),
  };
}

/** Totals for guests, built from the public activity (they never see individual amounts). */
export function totalsFromActivity(wedding: Wedding, activity: PublicActivity): WeddingTotals {
  const goals: GoalProgress[] = wedding.goals.map((goal) => {
    const { raised, count } = activity.goals[goal.id] ?? { raised: 0, count: 0 };
    return { goal, raised, verified: 0, count, percent: pct(raised, goal.target), funded: goal.target > 0 && raised >= goal.target };
  });
  const target = wedding.goals.reduce((t, g) => t + g.target, 0);
  return { raised: activity.raised, verified: 0, target, contributors: activity.contributors, percent: pct(activity.raised, target), goals };
}

/** Rough reach: how much a guest list typically gives, so targets stay realistic. */
export function expectedShagun(guests: number, average: number): number {
  return Math.max(0, Math.round(guests) * Math.max(0, Math.round(average)));
}
