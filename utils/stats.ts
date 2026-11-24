// utils/stats.ts
//
// Numbers for the Stats screen, all worked out from the completion log.

import {
  type Completion,
  type Repeat,
  addDays,
  getCurrentPeriod,
  isInPeriod,
  previousPeriod,
  requiredCount,
} from "./schedule";

/**
 * How many periods in a row this task was done, counting back from now.
 * The current period only counts once it's done; until then it doesn't break
 * the streak either (you still have time).
 */
export function taskStreak(
  repeat: Repeat,
  dates: string[],
  today: string,
  createdKey: string
): number {
  if (repeat.type === "none") return 0;
  const needed = requiredCount(repeat);
  const countIn = (p: { start: string; end: string }) =>
    dates.filter((d) => isInPeriod(d, p)).length;

  let period = getCurrentPeriod(repeat, today);
  let streak = 0;
  if (countIn(period) >= needed) streak++;
  for (let i = 0; i < 1000; i++) {
    period = previousPeriod(repeat, period);
    if (period.end <= createdKey) break; // before the task existed
    if (countIn(period) >= needed) streak++;
    else break;
  }
  return streak;
}

/**
 * Of the last `count` finished periods (not including the current one) since
 * the task was created, how many were done. Returns { hit, total }.
 */
export function recentHitRate(
  repeat: Repeat,
  dates: string[],
  today: string,
  createdKey: string,
  count: number
): { hit: number; total: number } {
  if (repeat.type === "none") return { hit: 0, total: 0 };
  const needed = requiredCount(repeat);
  let period = getCurrentPeriod(repeat, today);
  let hit = 0;
  let total = 0;
  for (let i = 0; i < count; i++) {
    period = previousPeriod(repeat, period);
    if (period.end <= createdKey) break;
    total++;
    if (dates.filter((d) => isInPeriod(d, period)).length >= needed) hit++;
  }
  return { hit, total };
}

/** Number of completions on each of the last `days` days, oldest first. */
export function dailyCounts(
  completions: Completion[],
  today: string,
  days: number
): { date: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const c of completions) counts.set(c.date, (counts.get(c.date) ?? 0) + 1);
  const out: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    out.push({ date, count: counts.get(date) ?? 0 });
  }
  return out;
}

/**
 * Days in a row with at least one check-off, ending today (or yesterday, if
 * nothing is checked off yet today).
 */
export function dayStreak(completions: Completion[], today: string): number {
  const days = new Set(completions.map((c) => c.date));
  let day = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}
