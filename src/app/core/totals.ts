import { Contribution, GoalProgress, Wedding, WeddingTotals } from './models';

const pct = (raised: number, target: number) => (target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0);

/** Contributions to goals that no longer exist are still counted in the wedding total. */
export function computeTotals(wedding: Wedding, contributions: readonly Contribution[]): WeddingTotals {
  const goals: GoalProgress[] = wedding.goals.map((goal) => {
    const mine = contributions.filter((c) => c.goalId === goal.id);
    const raised = sum(mine);
    return {
      goal,
      raised,
      verified: sum(mine.filter((c) => c.status === 'verified')),
      count: mine.length,
      percent: pct(raised, goal.target),
      funded: goal.target > 0 && raised >= goal.target,
    };
  });
  const raised = sum(contributions);
  const target = wedding.goals.reduce((t, g) => t + g.target, 0);
  return {
    raised,
    verified: sum(contributions.filter((c) => c.status === 'verified')),
    target,
    contributors: new Set(contributions.map((c) => c.guestName.trim().toLowerCase())).size,
    percent: pct(raised, target),
    goals,
  };
}

function sum(list: readonly Contribution[]): number {
  return list.reduce((t, c) => t + c.amount, 0);
}

/** Rough reach: how much a guest list typically gives, so targets stay realistic. */
export function expectedShagun(guests: number, average: number): number {
  return Math.max(0, Math.round(guests) * Math.max(0, Math.round(average)));
}
