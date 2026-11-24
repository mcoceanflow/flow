// utils/schedule.ts
//
// Repeat rules and "is this task done right now?" logic.
//
// Tasks don't store a `done` flag. Every check-off is saved as a Completion
// record, and a task counts as done when it has enough completions inside its
// *current period*:
//   - one-time task:          the period is "forever", so any completion counts
//   - every N days/weeks/months: a fixed block of time (e.g. every other week)
//   - N times per week:       this week, needing N completions (max one per day)
//
// All dates are local calendar days stored as "YYYY-MM-DD" strings, which sort
// correctly as plain strings. Weeks start on Sunday.

export type Repeat =
  | { type: "none" }
  | { type: "every"; n: number; unit: "day" | "week" | "month"; start: string }
  | { type: "quota"; times: number; per: "week" };

export type Completion = {
  id: string;
  taskId: string;
  date: string; // "YYYY-MM-DD", local
  completedAt: number;
};

/** A half-open date range: start <= date < end. */
export type Period = { start: string; end: string };

export const NO_REPEAT: Repeat = { type: "none" };

const FOREVER: Period = { start: "0000-01-01", end: "9999-12-31" };

/** Local calendar date of `d` as "YYYY-MM-DD". */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Firestore doc id for a task's completion on a given day (one per day max). */
export function completionId(taskId: string, date: string): string {
  return `${taskId}_${date}`;
}

// Date math is done on whole days since the epoch, using UTC so daylight
// saving changes can never shift a day.
function keyToDays(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

function daysToKey(days: number): string {
  const d = new Date(days * 86_400_000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Days-since-epoch of the Sunday on or before `key`. */
function startOfWeekDays(key: string): number {
  const days = keyToDays(key);
  const weekday = new Date(days * 86_400_000).getUTCDay(); // 0 = Sunday
  return days - weekday;
}

function monthIndex(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return y * 12 + (m - 1);
}

function monthIndexToKey(index: number): string {
  const y = Math.floor(index / 12);
  const m = String((index % 12) + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/** The period that `today` falls in for this repeat rule. */
export function getCurrentPeriod(repeat: Repeat, today: string): Period {
  switch (repeat.type) {
    case "none":
      return FOREVER;

    case "quota": {
      const start = startOfWeekDays(today);
      return { start: daysToKey(start), end: daysToKey(start + 7) };
    }

    case "every": {
      const n = Math.max(1, Math.floor(repeat.n));
      if (repeat.unit === "month") {
        // Fixed schedule of calendar-month blocks, counted from the start month.
        const startMonth = monthIndex(repeat.start);
        const k = Math.floor((monthIndex(today) - startMonth) / n);
        const blockStart = startMonth + k * n;
        return {
          start: monthIndexToKey(blockStart),
          end: monthIndexToKey(blockStart + n),
        };
      }
      // Days or weeks: fixed blocks of `length` days. Weekly blocks are lined
      // up to Sundays so "every week" means Sunday–Saturday.
      const length = repeat.unit === "week" ? 7 * n : n;
      const anchor =
        repeat.unit === "week"
          ? startOfWeekDays(repeat.start)
          : keyToDays(repeat.start);
      const k = Math.floor((keyToDays(today) - anchor) / length);
      const blockStart = anchor + k * length;
      return { start: daysToKey(blockStart), end: daysToKey(blockStart + length) };
    }
  }
}

/** How many completions in a period it takes to count as done. */
export function requiredCount(repeat: Repeat): number {
  return repeat.type === "quota" ? Math.max(1, repeat.times) : 1;
}

export function isInPeriod(date: string, period: Period): boolean {
  return date >= period.start && date < period.end;
}

/** `key` moved by `n` days (negative goes back). */
export function addDays(key: string, n: number): string {
  return daysToKey(keyToDays(key) + n);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(key: string): number {
  return new Date(keyToDays(key) * 86_400_000).getUTCDay();
}

/** The period just before `period`. */
export function previousPeriod(repeat: Repeat, period: Period): Period {
  return getCurrentPeriod(repeat, addDays(period.start, -1));
}

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "Mon, Dec 1" */
export function formatShortDate(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${WEEKDAY_SHORT[weekdayOf(key)]}, ${MONTH_SHORT[m - 1]} ${d}`;
}

/** The first date on or after `today` that falls on `weekday` (0 = Sunday). */
export function nextWeekday(weekday: number, today: string): string {
  return addDays(today, (weekday - weekdayOf(today) + 7) % 7);
}

/**
 * A repeating task is "upcoming" (not due yet) before its first due date.
 * Its periods begin on each due date, so it shows up in the list that day.
 */
export function isUpcoming(repeat: Repeat, today: string): boolean {
  return repeat.type === "every" && today < repeat.start;
}

/** The next due date on or after today, or null if it doesn't apply. */
export function nextDue(repeat: Repeat, today: string): string | null {
  if (repeat.type !== "every") return null;
  if (today < repeat.start) return repeat.start;
  const period = getCurrentPeriod(repeat, today);
  return period.start === today ? today : period.end;
}

/** Short label like "Daily", "Weekly on Monday" or "3× a week"; null for one-time. */
export function describeRepeat(repeat: Repeat): string | null {
  switch (repeat.type) {
    case "none":
      return null;
    case "quota":
      return `${repeat.times}× a week`;
    case "every": {
      const { n, unit } = repeat;
      if (unit === "day") {
        const day = WEEKDAY_NAMES[weekdayOf(repeat.start)];
        if (n === 1) return "Daily";
        if (n === 7) return `Weekly on ${day}`;
        if (n === 14) return `Every other ${day}`;
        if (n % 7 === 0) return `Every ${n / 7} weeks on ${day}`;
        return `Every ${n} days`;
      }
      if (n === 1) return unit === "week" ? "Weekly" : "Monthly";
      return `Every ${n} ${unit}s`;
    }
  }
}

/**
 * True when two rules produce the same schedule — e.g. the same "every 14
 * days" rule anchored two weeks apart. Used so re-saving a task without
 * changing its repeat doesn't move its start date.
 */
export function sameSchedule(a: Repeat, b: Repeat): boolean {
  if (a.type === "none" && b.type === "none") return true;
  if (a.type === "quota" && b.type === "quota") return a.times === b.times;
  if (a.type === "every" && b.type === "every") {
    if (a.n !== b.n || a.unit !== b.unit) return false;
    const mod = (x: number, m: number) => ((x % m) + m) % m;
    if (a.unit === "month") {
      const months = (k: string) => {
        const [y, m] = k.split("-").map(Number);
        return y * 12 + m;
      };
      return mod(months(a.start) - months(b.start), a.n) === 0;
    }
    const len = a.unit === "week" ? 7 * a.n : a.n;
    const anchor = (k: string) => (a.unit === "week" ? startOfWeekDays(k) : keyToDays(k));
    return mod(anchor(a.start) - anchor(b.start), len) === 0;
  }
  return false;
}
