// utils/items.ts
//
// Turns raw tasks + the completion log into what the list shows: whether each
// task or group is done, upcoming, how far along its goal is, and so on.
// Pure functions only (no Firestore or React), so it's easy to test.

import {
  type Completion,
  type Period,
  type Repeat,
  addDays,
  describeRepeat,
  formatShortDate,
  getCurrentPeriod,
  isInPeriod,
  isUpcoming,
  nextDue,
  requiredCount,
  weekdayOf,
} from "./schedule";

// What's stored in Firestore. Whether a task is done is NOT stored here: it's
// worked out from the `completions` collection (see utils/schedule.ts).
export type Todo = {
  id: string;
  text: string;
  createdAt: number;
  order: number;
  parentId: string | null; // the group it's in; null = main list
  kind: "task" | "group";
  repeat: Repeat;
};

// How a "times per week" goal is going: "tight" = it needs every day left,
// including today; "behind" = it can't be reached this week any more (more
// check-offs needed than days left to do them).
export type QuotaTone = "ok" | "tight" | "behind";

// A Todo plus its done state for the current period, ready to render.
export type TodoItem = Todo & {
  done: boolean;
  upcoming: boolean; // repeating item whose first due date hasn't come yet
  nextDue: string | null; // next due date, for repeating items
  daysLeft: number; // "times per week": days left this week to still check off
  quotaTone: QuotaTone;
  progress: number; // 0..1, for a group's pie
  periodCount: number; // check-offs this period toward the repeat goal
  periodTarget: number; // check-offs needed this period
  childDone: number; // groups: subtasks done (this session, if the group repeats)
  childTotal: number; // groups: subtasks counted
  inheritsRepeat: boolean; // subtask of a repeating group: resets with the group
  sessionComplete: boolean; // repeating group: every subtask done this session
  sessionOwnCompletionIds: string[]; // repeating group: its own check-offs this session
  lastCompletedAt: number | null; // latest completion in the current period
  periodCompletionIds: string[]; // completions in the current period
  allCompletionIds: string[]; // every completion ever, incl. subtasks' for groups
  childIds: string[]; // subtasks (groups only)
};

type RepeatStatus = Pick<
  TodoItem,
  | "done"
  | "upcoming"
  | "nextDue"
  | "daysLeft"
  | "quotaTone"
  | "periodCount"
  | "periodTarget"
  | "lastCompletedAt"
  | "periodCompletionIds"
>;

function latestCompletedAt(cs: Completion[]): number | null {
  return cs.reduce<number | null>(
    (max, c) => (max === null || c.completedAt > max ? c.completedAt : max),
    null
  );
}

// Where a task (or repeating group) stands against its repeat rule today,
// based on its own check-offs.
function repeatStatus(repeat: Repeat, own: Completion[], today: string): RepeatStatus {
  const period = getCurrentPeriod(repeat, today);
  const inPeriod = own.filter((c) => isInPeriod(c.date, period));
  const target = requiredCount(repeat);
  const upcoming = isUpcoming(repeat, today);
  const goalMet = inPeriod.length >= target;

  let done = !upcoming && goalMet;
  let daysLeft = 0;
  let quotaTone: QuotaTone = "ok";
  if (repeat.type === "quota") {
    // Done for the day once checked off today (back tomorrow), and for the
    // rest of the week once the goal is met.
    const doneToday = inPeriod.some((c) => c.date === today);
    done = goalMet || doneToday;
    daysLeft = 7 - weekdayOf(today) - (doneToday ? 1 : 0);
    const needed = target - inPeriod.length;
    if (!goalMet && needed > daysLeft) quotaTone = "behind";
    else if (!goalMet && needed === daysLeft) quotaTone = "tight";
  }

  return {
    done,
    upcoming,
    nextDue: nextDue(repeat, today),
    daysLeft,
    quotaTone,
    periodCount: inPeriod.length,
    periodTarget: target,
    lastCompletedAt: latestCompletedAt(inPeriod),
    periodCompletionIds: inPeriod.map((c) => c.id),
  };
}

// In a repeating group, subtasks reset every "session": each day for a
// "times per week" group, otherwise each of the group's periods.
function sessionPeriod(repeat: Repeat, today: string): Period {
  return repeat.type === "quota"
    ? { start: today, end: addDays(today, 1) }
    : getCurrentPeriod(repeat, today);
}

const NO_GROUP_FIELDS = {
  childDone: 0,
  childTotal: 0,
  sessionComplete: false,
  sessionOwnCompletionIds: [] as string[],
  childIds: [] as string[],
};

// Combine tasks with their completions to get each item's state for `today`.
export function buildItems(todos: Todo[], completions: Completion[], today: string): TodoItem[] {
  const byTask = new Map<string, Completion[]>();
  for (const c of completions) {
    const list = byTask.get(c.taskId);
    if (list) list.push(c);
    else byTask.set(c.taskId, [c]);
  }

  // A task whose group no longer exists falls back to the main list.
  const groupIds = new Set(todos.filter((t) => t.kind === "group").map((t) => t.id));
  const normalized = todos.map((t) => ({
    ...t,
    parentId: t.kind === "task" && t.parentId && groupIds.has(t.parentId) ? t.parentId : null,
  }));

  const groupsById = new Map(
    normalized.filter((t) => t.kind === "group").map((g) => [g.id, g])
  );

  const tasks = new Map<string, TodoItem>();
  for (const t of normalized) {
    if (t.kind !== "task") continue;
    const all = byTask.get(t.id) ?? [];
    const parent = t.parentId ? groupsById.get(t.parentId) : undefined;

    if (parent && parent.repeat.type !== "none") {
      // Subtask of a repeating group: its own repeat is ignored, and it's
      // simply done or not done for the group's current session.
      const upcoming = isUpcoming(parent.repeat, today);
      const session = sessionPeriod(parent.repeat, today);
      const inSession = all.filter((c) => isInPeriod(c.date, session));
      const done = !upcoming && inSession.length > 0;
      tasks.set(t.id, {
        ...t,
        ...NO_GROUP_FIELDS,
        done,
        upcoming,
        nextDue: null,
        daysLeft: 0,
        quotaTone: "ok",
        progress: done ? 1 : 0,
        periodCount: inSession.length,
        periodTarget: 1,
        inheritsRepeat: true,
        lastCompletedAt: latestCompletedAt(inSession),
        periodCompletionIds: inSession.map((c) => c.id),
        allCompletionIds: all.map((c) => c.id),
      });
      continue;
    }

    const status = repeatStatus(t.repeat, all, today);
    tasks.set(t.id, {
      ...t,
      ...NO_GROUP_FIELDS,
      ...status,
      progress: status.done ? 1 : 0,
      inheritsRepeat: false,
      allCompletionIds: all.map((c) => c.id),
    });
  }

  return normalized.map((t) => {
    if (t.kind === "task") return tasks.get(t.id)!;
    const children = [...tasks.values()].filter((c) => c.parentId === t.id);
    const childCompletionIds = children.flatMap((c) => c.allCompletionIds);
    const childLatest = children.reduce<number | null>(
      (max, c) =>
        c.lastCompletedAt !== null && (max === null || c.lastCompletedAt > max)
          ? c.lastCompletedAt
          : max,
      null
    );

    if (t.repeat.type === "none") {
      // Plain group: done when every subtask that's due is done. Subtasks
      // that aren't due yet don't count toward the pie.
      const due = children.filter((c) => !c.upcoming);
      const doneCount = due.filter((c) => c.done).length;
      return {
        ...t,
        done: due.length > 0 && doneCount === due.length,
        upcoming: children.length > 0 && due.length === 0,
        nextDue: null,
        daysLeft: 0,
        quotaTone: "ok" as QuotaTone,
        progress: due.length > 0 ? doneCount / due.length : 0,
        periodCount: doneCount,
        periodTarget: due.length,
        childDone: doneCount,
        childTotal: due.length,
        inheritsRepeat: false,
        sessionComplete: false,
        sessionOwnCompletionIds: [],
        lastCompletedAt: childLatest,
        periodCompletionIds: [],
        allCompletionIds: childCompletionIds,
        childIds: children.map((c) => c.id),
      };
    }

    // Repeating group: the group itself has check-offs (one per session where
    // every subtask got done), and those count toward its repeat goal.
    const own = byTask.get(t.id) ?? [];
    const status = repeatStatus(t.repeat, own, today);
    const session = sessionPeriod(t.repeat, today);
    const doneCount = children.filter((c) => c.done).length;
    return {
      ...t,
      ...status,
      progress: children.length > 0 ? doneCount / children.length : 0,
      childDone: doneCount,
      childTotal: children.length,
      inheritsRepeat: false,
      sessionComplete: !status.upcoming && children.length > 0 && doneCount === children.length,
      sessionOwnCompletionIds: own.filter((c) => isInPeriod(c.date, session)).map((c) => c.id),
      lastCompletedAt: status.lastCompletedAt ?? childLatest,
      allCompletionIds: [...own.map((c) => c.id), ...childCompletionIds],
      childIds: children.map((c) => c.id),
    };
  });
}

export function subtitleFor(item: TodoItem): { text: string; tone: QuotaTone } | null {
  if (item.inheritsRepeat) return null;
  if (item.kind === "group") {
    if (item.childIds.length === 0) return { text: "No subtasks yet", tone: "ok" };
    if (item.repeat.type === "none") {
      if (item.upcoming) return { text: "Nothing due yet", tone: "ok" };
      return { text: `${item.childDone} of ${item.childTotal} done`, tone: "ok" };
    }
  }
  if (item.repeat.type === "quota") {
    const goalMet = item.periodCount >= item.periodTarget;
    const left = goalMet
      ? ""
      : ` · ${item.daysLeft} day${item.daysLeft === 1 ? "" : "s"} left`;
    return {
      text: `${item.periodCount}/${item.periodTarget} this week${left}`,
      tone: item.quotaTone,
    };
  }
  const rule = describeRepeat(item.repeat);
  if (!rule) return null;
  // Show the next due date once it's done, or before it's first due.
  if ((item.done || item.upcoming) && item.nextDue) {
    return { text: `${rule} · next ${formatShortDate(item.nextDue)}`, tone: "ok" };
  }
  return { text: rule, tone: "ok" };
}

