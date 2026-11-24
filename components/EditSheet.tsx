// components/EditSheet.tsx
//
// Bottom sheet for renaming a task or group and (for tasks) choosing how it
// repeats.

import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import {
  type Repeat,
  NO_REPEAT,
  WEEKDAY_NAMES,
  addDays,
  formatShortDate,
  nextDue,
  nextWeekday,
  sameSchedule,
  weekdayOf,
} from "../utils/schedule";

type Choice = "none" | "daily" | "weekly" | "everyN" | "monthly" | "perWeek";

const CHOICES: { key: Choice; label: string }[] = [
  { key: "none", label: "Never" },
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "everyN", label: "Every N days" },
  { key: "monthly", label: "Monthly" },
  { key: "perWeek", label: "Times per week" },
];

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

type Form = {
  choice: Choice;
  weekday: number; // weekly: 0 = Sunday
  n: number; // every N days
  nextDate: string; // every N days: next due date
  times: number; // times per week
};

function formFromRepeat(r: Repeat, today: string): Form {
  const base: Form = {
    choice: "none",
    weekday: weekdayOf(today),
    n: 14,
    nextDate: today,
    times: 3,
  };
  if (r.type === "quota") return { ...base, choice: "perWeek", times: r.times };
  if (r.type === "every") {
    if (r.unit === "day" && r.n === 1) return { ...base, choice: "daily" };
    if (r.unit === "day" && r.n === 7) {
      return { ...base, choice: "weekly", weekday: weekdayOf(r.start) };
    }
    if (r.unit === "day") {
      return { ...base, choice: "everyN", n: r.n, nextDate: nextDue(r, today) ?? today };
    }
    // Older "weekly" tasks ran Sunday to Saturday.
    if (r.unit === "week" && r.n === 1) return { ...base, choice: "weekly", weekday: 0 };
    if (r.unit === "month" && r.n === 1) return { ...base, choice: "monthly" };
  }
  return base;
}

function repeatFromForm(f: Form, today: string): Repeat {
  switch (f.choice) {
    case "none":
      return NO_REPEAT;
    case "daily":
      return { type: "every", n: 1, unit: "day", start: today };
    case "weekly":
      return { type: "every", n: 7, unit: "day", start: nextWeekday(f.weekday, today) };
    case "everyN":
      return { type: "every", n: f.n, unit: "day", start: f.nextDate };
    case "monthly":
      return { type: "every", n: 1, unit: "month", start: today };
    case "perWeek":
      return { type: "quota", times: f.times, per: "week" };
  }
}

function Stepper({
  label,
  onMinus,
  onPlus,
  minusDisabled,
  plusDisabled,
}: {
  label: string;
  onMinus: () => void;
  onPlus: () => void;
  minusDisabled?: boolean;
  plusDisabled?: boolean;
}) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity style={styles.stepButton} onPress={onMinus} disabled={minusDisabled}>
        <Text style={[styles.stepButtonText, minusDisabled && styles.dim]}>‹</Text>
      </TouchableOpacity>
      <Text style={styles.stepValue}>{label}</Text>
      <TouchableOpacity style={styles.stepButton} onPress={onPlus} disabled={plusDisabled}>
        <Text style={[styles.stepButtonText, plusDisabled && styles.dim]}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function EditSheet({
  visible,
  isGroup,
  lockedBy,
  text,
  repeat,
  today,
  onSave,
  onClose,
}: {
  visible: boolean;
  isGroup: boolean;
  lockedBy: string | null; // subtask of a repeating group: that group's name
  text: string;
  repeat: Repeat;
  today: string;
  onSave: (text: string, repeat: Repeat) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(text);
  const [form, setForm] = useState<Form>(() => formFromRepeat(repeat, today));
  const update = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!visible) return;
    setName(text);
    setForm(formFromRepeat(repeat, today));
  }, [visible, text, repeat, today]);

  const save = () => {
    if (!name.trim()) return;
    let next = repeatFromForm(form, today);
    // Keep the original start date when the schedule didn't actually change,
    // so a fixed schedule (e.g. every other Monday) doesn't shift.
    if (sameSchedule(next, repeat)) next = repeat;
    onSave(name.trim(), next);
  };

  const renderOptions = (choice: Choice) => {
    if (form.choice !== choice) return null;
    switch (choice) {
      case "weekly":
        return (
          <View style={styles.optionDetail}>
            <View style={styles.weekdays}>
              {WEEKDAY_LETTERS.map((letter, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.weekday, form.weekday === i && styles.weekdayOn]}
                  onPress={() => update({ weekday: i })}
                >
                  <Text style={[styles.weekdayText, form.weekday === i && styles.weekdayTextOn]}>
                    {letter}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.hint}>
              Every {WEEKDAY_NAMES[form.weekday]} · next{" "}
              {formatShortDate(nextWeekday(form.weekday, today))}
            </Text>
          </View>
        );
      case "everyN":
        return (
          <View style={styles.optionDetail}>
            <Stepper
              label={`Every ${form.n} days`}
              onMinus={() => update({ n: Math.max(2, form.n - 1) })}
              onPlus={() => update({ n: Math.min(90, form.n + 1) })}
              minusDisabled={form.n <= 2}
              plusDisabled={form.n >= 90}
            />
            <Stepper
              label={`Next: ${formatShortDate(form.nextDate)}`}
              onMinus={() => update({ nextDate: addDays(form.nextDate, -1) })}
              onPlus={() => update({ nextDate: addDays(form.nextDate, 1) })}
              minusDisabled={form.nextDate <= today}
            />
            <Text style={styles.hint}>
              Then every {form.n} days after that. For every other Monday, pick 14
              days and set Next to a Monday.
            </Text>
          </View>
        );
      case "perWeek":
        return (
          <View style={styles.optionDetail}>
            <Stepper
              label={`${form.times}× a week`}
              onMinus={() => update({ times: Math.max(1, form.times - 1) })}
              onPlus={() => update({ times: Math.min(7, form.times + 1) })}
              minusDisabled={form.times <= 1}
              plusDisabled={form.times >= 7}
            />
            <Text style={styles.hint}>
              {isGroup
                ? "A day counts once every subtask is done. Subtasks reset each day. Weeks run Sunday to Saturday."
                : "Check it off once on any day you do it. Weeks run Sunday to Saturday."}
            </Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      allowSwipeDismissal
      onRequestClose={onClose}
    >
      <View style={styles.flex}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Text style={styles.headerButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isGroup ? "Edit group" : "Edit task"}</Text>
          <TouchableOpacity onPress={save} hitSlop={10} disabled={!name.trim()}>
            <Text style={[styles.headerButton, styles.bold, !name.trim() && styles.dim]}>
              Save
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Name"
            placeholderTextColor="#9a9a9a"
            returnKeyType="done"
            onSubmitEditing={save}
          />

          {lockedBy ? (
            <>
              <Text style={styles.sectionLabel}>Repeat</Text>
              <Text style={styles.lockedNote}>
                Repeats with “{lockedBy}”. Change it by editing the group.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.sectionLabel}>Repeat</Text>
              {isGroup && form.choice !== "none" && form.choice !== "perWeek" && (
                <Text style={styles.lockedNote}>
                  Subtasks reset each time the group comes due.
                </Text>
              )}
              {CHOICES.map((c) => (
                <View key={c.key}>
                  <TouchableOpacity style={styles.option} onPress={() => update({ choice: c.key })}>
                    <Text style={styles.optionText}>{c.label}</Text>
                    {form.choice === c.key && <Text style={styles.check}>✓</Text>}
                  </TouchableOpacity>
                  {renderOptions(c.key)}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fafafa" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },
  headerButton: { fontSize: 16, color: "#007aff" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#111" },
  bold: { fontWeight: "700" },
  dim: { opacity: 0.3 },
  body: { paddingHorizontal: 20, paddingBottom: 40 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e2e2",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111",
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#888",
    textTransform: "uppercase",
    marginTop: 28,
    marginBottom: 4,
  },
  option: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  optionText: { fontSize: 16, color: "#111" },
  check: { fontSize: 16, color: "#007aff", fontWeight: "700" },
  optionDetail: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  weekdays: { flexDirection: "row", justifyContent: "space-between" },
  weekday: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
  },
  weekdayOn: { backgroundColor: "#111" },
  weekdayText: { fontSize: 15, fontWeight: "600", color: "#111" },
  weekdayTextOn: { color: "#fff" },
  hint: { fontSize: 13, color: "#888", marginTop: 10, textAlign: "center" },
  lockedNote: { fontSize: 14, color: "#888", marginTop: 6, marginBottom: 4 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
  },
  stepButtonText: { fontSize: 22, color: "#111", marginTop: -2 },
  stepValue: { fontSize: 16, color: "#111", minWidth: 170, textAlign: "center" },
});
