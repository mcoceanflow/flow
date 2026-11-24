// screens/Stats.tsx
//
// Progress at a glance: totals, the last 7 days, and for each repeating task
// its streak, recent hit rate and a 12-week calendar heatmap.
// Charts are plain Views, so no native chart library is needed.

import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { TodoItem } from "../utils/items";
import {
  type Completion,
  addDays,
  describeRepeat,
  toDateKey,
  weekdayOf,
} from "../utils/schedule";
import { dailyCounts, dayStreak, recentHitRate, taskStreak } from "../utils/stats";

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const HEATMAP_WEEKS = 12;

function Tile({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function WeekBars({ data, today }: { data: { date: string; count: number }[]; today: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <View style={styles.bars}>
      {data.map((d) => (
        <View key={d.date} style={styles.barColumn}>
          <Text style={styles.barCount}>{d.count > 0 ? d.count : ""}</Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { height: `${(d.count / max) * 100}%` },
                d.date === today && styles.barToday,
              ]}
            />
          </View>
          <Text style={[styles.barLabel, d.date === today && styles.barLabelToday]}>
            {WEEKDAY_LETTERS[weekdayOf(d.date)]}
          </Text>
        </View>
      ))}
    </View>
  );
}

// GitHub-style grid: one column per week (Sun at top), oldest on the left.
function Heatmap({ dates, today }: { dates: Set<string>; today: string }) {
  const thisSunday = addDays(today, -weekdayOf(today));
  const firstSunday = addDays(thisSunday, -7 * (HEATMAP_WEEKS - 1));
  const columns = Array.from({ length: HEATMAP_WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(firstSunday, w * 7 + d))
  );
  return (
    <View style={styles.heatmap}>
      {columns.map((week) => (
        <View key={week[0]} style={styles.heatColumn}>
          {week.map((date) => (
            <View
              key={date}
              style={[
                styles.heatCell,
                date > today
                  ? styles.heatFuture
                  : dates.has(date)
                  ? styles.heatOn
                  : styles.heatOff,
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export default function Stats({
  items,
  completions,
  today,
  onBack,
}: {
  items: TodoItem[];
  completions: Completion[];
  today: string;
  onBack: () => void;
}) {
  // Totals count tasks checked off; a repeating group's own check-off (all its
  // subtasks done) would double-count them, so it's left out here.
  const taskCompletions = useMemo(() => {
    const groupIds = new Set(items.filter((t) => t.kind === "group").map((g) => g.id));
    return completions.filter((c) => !groupIds.has(c.taskId));
  }, [items, completions]);
  const last7 = useMemo(() => dailyCounts(taskCompletions, today, 7), [taskCompletions, today]);
  const weekStart = addDays(today, -weekdayOf(today));
  const thisWeek = taskCompletions.filter((c) => c.date >= weekStart && c.date <= today).length;
  const todayCount = taskCompletions.filter((c) => c.date === today).length;
  const streak = dayStreak(taskCompletions, today);

  const habits = useMemo(() => {
    const groupNames = new Map(
      items.filter((t) => t.kind === "group").map((g) => [g.id, g.text])
    );
    // Repeating tasks and repeating groups. Subtasks of a repeating group
    // follow the group, so the group is tracked instead.
    return items
      .filter((t) => t.repeat.type !== "none" && !t.inheritsRepeat)
      .map((t) => {
        const dates = completions.filter((c) => c.taskId === t.id).map((c) => c.date);
        // Don't count periods from before the task (or its current schedule) began.
        const createdKey = toDateKey(new Date(t.createdAt ?? Date.now()));
        const created =
          t.repeat.type === "every" && t.repeat.start > createdKey ? t.repeat.start : createdKey;
        return {
          item: t,
          group: t.parentId ? groupNames.get(t.parentId) : undefined,
          dates: new Set(dates),
          streak: taskStreak(t.repeat, dates, today, created),
          rate: recentHitRate(t.repeat, dates, today, created, 8),
        };
      })
      .sort((a, b) => b.streak - a.streak);
  }, [items, completions, today]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity onPress={onBack} hitSlop={10} style={styles.backButton}>
          <Text style={styles.backText}>‹ Flow</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Stats</Text>

        <View style={styles.tiles}>
          <Tile value={todayCount} label="Today" />
          <Tile value={thisWeek} label="This week" />
          <Tile value={streak} label="Day streak" />
        </View>

        <Text style={styles.sectionLabel}>Last 7 days</Text>
        <View style={styles.card}>
          <WeekBars data={last7} today={today} />
        </View>

        <Text style={styles.sectionLabel}>Repeating tasks</Text>
        {habits.length === 0 ? (
          <Text style={styles.emptyText}>
            Tap a task's name and set it to repeat to track it here.
          </Text>
        ) : (
          habits.map(({ item, group, dates, streak: s, rate }) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.habitHeader}>
                <View style={styles.habitTitleWrap}>
                  <Text style={styles.habitTitle}>{item.text}</Text>
                  <Text style={styles.habitMeta}>
                    {[group, describeRepeat(item.repeat)].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                <View style={styles.streakBadge}>
                  <Text style={styles.streakValue}>{s}</Text>
                  <Text style={styles.streakLabel}>in a row</Text>
                </View>
              </View>
              <Heatmap dates={dates} today={today} />
              <Text style={styles.habitFooter}>
                {item.repeat.type === "quota"
                  ? `This week: ${item.periodCount}/${item.periodTarget}`
                  : item.done
                  ? "Done for this period ✓"
                  : "Not done yet this period"}
                {rate.total > 0 ? `   ·   ${rate.hit}/${rate.total} recent periods hit` : ""}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const CELL = 14;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fafafa" },
  container: { paddingHorizontal: 20, paddingBottom: 40 },
  backButton: { marginTop: 8, alignSelf: "flex-start" },
  backText: { fontSize: 17, color: "#007aff" },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#111",
    marginTop: 12,
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  tiles: { flexDirection: "row", gap: 10 },
  tile: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eee",
    paddingVertical: 14,
    alignItems: "center",
  },
  tileValue: { fontSize: 26, fontWeight: "800", color: "#111" },
  tileLabel: { fontSize: 12, color: "#888", marginTop: 2 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#888",
    textTransform: "uppercase",
    marginTop: 28,
    marginBottom: 8,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eee",
    padding: 16,
    marginBottom: 10,
  },
  bars: { flexDirection: "row", height: 140, alignItems: "flex-end" },
  barColumn: { flex: 1, alignItems: "center" },
  barCount: { fontSize: 12, color: "#888", marginBottom: 4, height: 16 },
  barTrack: { width: 18, height: 90, justifyContent: "flex-end" },
  barFill: { width: "100%", backgroundColor: "#c9c9c9", borderRadius: 5 },
  barToday: { backgroundColor: "#111" },
  barLabel: { fontSize: 12, color: "#aaa", marginTop: 6 },
  barLabelToday: { color: "#111", fontWeight: "700" },
  emptyText: { fontSize: 14, color: "#999" },
  habitHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  habitTitleWrap: { flex: 1, marginRight: 12 },
  habitTitle: { fontSize: 16, fontWeight: "600", color: "#111" },
  habitMeta: { fontSize: 13, color: "#888", marginTop: 2 },
  streakBadge: { alignItems: "center" },
  streakValue: { fontSize: 22, fontWeight: "800", color: "#111" },
  streakLabel: { fontSize: 11, color: "#888" },
  heatmap: { flexDirection: "row", gap: 3 },
  heatColumn: { gap: 3 },
  heatCell: { width: CELL, height: CELL, borderRadius: 3 },
  heatOn: { backgroundColor: "#111" },
  heatOff: { backgroundColor: "#ececec" },
  heatFuture: { backgroundColor: "transparent" },
  habitFooter: { fontSize: 12, color: "#888", marginTop: 10 },
});
