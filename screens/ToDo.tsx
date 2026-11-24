// Screens/ToDo.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  AppState,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { useAnimatedRef } from "react-native-reanimated";
import { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import Sortable, { type SortableGridRenderItem } from "react-native-sortables";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  writeBatch,
  deleteField,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { getOrderBetween, getOrderForNewItem } from "../utils/order";
import {
  type Completion,
  type Repeat,
  NO_REPEAT,
  completionId,
  toDateKey,
} from "../utils/schedule";
import { type Todo, type TodoItem, buildItems, subtitleFor } from "../utils/items";
import ProgressPie from "../components/ProgressPie";
import SwipeRow, { type RowAction } from "../components/SwipeRow";
import MoveSheet from "../components/MoveSheet";
import EditSheet from "../components/EditSheet";
import Stats from "./Stats";

// Today's local date ("YYYY-MM-DD"). Updates at midnight and whenever the app
// comes back to the foreground, so repeating tasks reset on their own.
function useToday(): string {
  const [today, setToday] = useState(() => toDateKey(new Date()));
  useEffect(() => {
    const refresh = () => setToday(toDateKey(new Date()));
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    let timer: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      timer = setTimeout(() => {
        refresh();
        scheduleMidnight();
      }, next.getTime() - now.getTime());
    };
    scheduleMidnight();
    return () => {
      sub.remove();
      clearTimeout(timer);
    };
  }, []);
  return today;
}

type LegacyTodo = {
  id: string;
  done: boolean;
  completedAt: number | null;
  createdAt: number;
};

// One-time upgrade for tasks saved before the completion log existed: turn
// `done: true` into a completion record and drop the old `done`/`completedAt`
// fields. Safe to run more than once (the completion's id is deterministic).
async function migrateLegacyDone(legacy: LegacyTodo[]) {
  const batch = writeBatch(db);
  for (const t of legacy) {
    if (t.done) {
      const completedAt = t.completedAt ?? t.createdAt ?? Date.now();
      const date = toDateKey(new Date(completedAt));
      batch.set(doc(db, "completions", completionId(t.id, date)), {
        taskId: t.id,
        date,
        completedAt,
      });
    }
    batch.update(doc(db, "todos", t.id), {
      done: deleteField(),
      completedAt: deleteField(),
    });
  }
  await batch.commit();
}

export default function ToDo() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [input, setInput] = useState("");
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const today = useToday();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const openRowRef = useRef<SwipeableMethods | null>(null);
  const migratingRef = useRef(false);

  useEffect(() => {
    // No orderBy here on purpose: undone and done items need two different
    // sort orders, so we fetch everything once and split/sort client-side.
    const unsubscribe = onSnapshot(collection(db, "todos"), (snapshot) => {
      const legacy: LegacyTodo[] = [];
      const items: Todo[] = snapshot.docs.map((d) => {
        const data = d.data();
        if ("done" in data) {
          legacy.push({
            id: d.id,
            done: !!data.done,
            completedAt: data.completedAt ?? null,
            createdAt: data.createdAt,
          });
        }
        return {
          id: d.id,
          text: data.text,
          createdAt: data.createdAt,
          // Fallback for any pre-existing docs written before `order` existed.
          order: typeof data.order === "number" ? data.order : Number.POSITIVE_INFINITY,
          parentId: data.parentId ?? null,
          kind: data.kind ?? "task",
          repeat: data.repeat ?? NO_REPEAT,
        };
      });
      setTodos(items);
      if (legacy.length > 0 && !migratingRef.current) {
        migratingRef.current = true;
        migrateLegacyDone(legacy)
          .catch((e) => console.warn("Migrating done tasks failed", e))
          .finally(() => {
            migratingRef.current = false;
          });
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "completions"), (snapshot) => {
      setCompletions(
        snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Completion, "id">) }))
      );
    });
    return unsubscribe;
  }, []);

  const items = useMemo(() => buildItems(todos, completions, today), [todos, completions, today]);
  const itemsById = useMemo(() => new Map(items.map((t) => [t.id, t])), [items]);
  const groups = useMemo(
    () =>
      items
        .filter((t) => t.kind === "group")
        .sort((a, b) => a.order - b.order)
        .map((g) => ({ id: g.id, text: g.text })),
    [items]
  );

  // Keep each repeating group's own check-off in sync with its subtasks: when
  // every subtask is done this session, the group gets a check-off for today
  // (that's what counts toward "5× a week" and the stats); when one is
  // unchecked again, it's removed. Ids are deterministic, so running this on
  // two devices at once is harmless.
  useEffect(() => {
    for (const g of items) {
      if (g.kind !== "group" || g.repeat.type === "none" || g.upcoming) continue;
      const hasCheckOff = g.sessionOwnCompletionIds.length > 0;
      if (g.sessionComplete && !hasCheckOff) {
        const date = toDateKey(new Date());
        setDoc(doc(db, "completions", completionId(g.id, date)), {
          taskId: g.id,
          date,
          completedAt: Date.now(),
        }).catch((e) => console.warn("Saving group check-off failed", e));
      } else if (!g.sessionComplete && hasCheckOff) {
        const batch = writeBatch(db);
        for (const id of g.sessionOwnCompletionIds) batch.delete(doc(db, "completions", id));
        batch.commit().catch((e) => console.warn("Removing group check-off failed", e));
      }
    }
  }, [items]);

  const openGroup = openGroupId ? itemsById.get(openGroupId) : undefined;

  // If the open group gets deleted (here or on another device), go back.
  useEffect(() => {
    if (openGroupId && todos.length > 0 && !openGroup) setOpenGroupId(null);
  }, [openGroupId, openGroup, todos.length]);

  // Only the items at the level being viewed: the main list or one group.
  const levelItems = useMemo(
    () => items.filter((t) => t.parentId === (openGroup ? openGroup.id : null)),
    [items, openGroup]
  );

  const undoneTodos = useMemo(
    () =>
      levelItems.filter((t) => !t.done && !t.upcoming).sort((a, b) => a.order - b.order),
    [levelItems]
  );

  // Repeating tasks not due yet, soonest first.
  const upcomingTodos = useMemo(
    () =>
      levelItems
        .filter((t) => !t.done && t.upcoming)
        .sort((a, b) => (a.nextDue ?? "").localeCompare(b.nextDue ?? "")),
    [levelItems]
  );

  const doneTodos = useMemo(
    () =>
      levelItems
        .filter((t) => t.done)
        .sort((a, b) => (b.lastCompletedAt ?? 0) - (a.lastCompletedAt ?? 0)),
    [levelItems]
  );

  const addTodo = async () => {
    if (!input.trim()) return;
    const newOrder = getOrderForNewItem(undoneTodos.map((t) => t.order));
    await addDoc(collection(db, "todos"), {
      text: input.trim(),
      createdAt: Date.now(),
      order: newOrder,
      parentId: openGroup ? openGroup.id : null,
      kind: "task",
      repeat: NO_REPEAT,
    });
    setInput("");
  };

  // Checking off adds a completion for today; unchecking removes completions
  // from this period. Neither touches `order`, so an unchecked item reappears
  // exactly where it was before it was marked done.
  const toggleTodo = useCallback(async (item: TodoItem) => {
    const todayKey = toDateKey(new Date());
    const todayId = completionId(item.id, todayKey);
    const hasToday = item.periodCompletionIds.includes(todayId);

    if (item.repeat.type === "quota" && !item.inheritsRepeat) {
      // "N times a week": each tap adds today, or undoes one check-off.
      if (hasToday) {
        await deleteDoc(doc(db, "completions", todayId));
      } else if (item.done) {
        const latest = [...item.periodCompletionIds].sort().pop();
        if (latest) await deleteDoc(doc(db, "completions", latest));
      } else {
        await setDoc(doc(db, "completions", todayId), {
          taskId: item.id,
          date: todayKey,
          completedAt: Date.now(),
        });
      }
      return;
    }

    if (item.done) {
      const batch = writeBatch(db);
      for (const id of item.periodCompletionIds) {
        batch.delete(doc(db, "completions", id));
      }
      await batch.commit();
    } else {
      await setDoc(doc(db, "completions", todayId), {
        taskId: item.id,
        date: todayKey,
        completedAt: Date.now(),
      });
    }
  }, []);

  // Deleting a task also deletes its history; deleting a group also deletes
  // its subtasks and their history (after asking).
  const removeItem = useCallback((item: TodoItem) => {
    const doDelete = async () => {
      const batch = writeBatch(db);
      batch.delete(doc(db, "todos", item.id));
      for (const id of item.childIds) batch.delete(doc(db, "todos", id));
      for (const id of item.allCompletionIds) batch.delete(doc(db, "completions", id));
      await batch.commit();
    };
    if (item.kind === "group" && item.childIds.length > 0) {
      const n = item.childIds.length;
      Alert.alert(
        `Delete "${item.text}"?`,
        `This also deletes its ${n} subtask${n === 1 ? "" : "s"}.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: doDelete },
        ]
      );
    } else {
      doDelete();
    }
  }, []);

  const movingItem = movingId ? itemsById.get(movingId) : undefined;
  const editingItem = editingId ? itemsById.get(editingId) : undefined;

  const moveTo = async (groupId: string | null) => {
    if (!movingItem) return;
    const siblingOrders = items.filter((t) => t.parentId === groupId).map((t) => t.order);
    setMovingId(null);
    await updateDoc(doc(db, "todos", movingItem.id), {
      parentId: groupId,
      order: getOrderForNewItem(siblingOrders),
    });
  };

  // Make a new group and put the task in it. A task from the main list leaves
  // its group in its old spot; otherwise the group goes to the top.
  const moveToNewGroup = async (name: string) => {
    if (!movingItem) return;
    const groupOrder =
      movingItem.parentId === null
        ? movingItem.order
        : getOrderForNewItem(items.filter((t) => t.parentId === null).map((t) => t.order));
    const groupRef = doc(collection(db, "todos"));
    const batch = writeBatch(db);
    batch.set(groupRef, {
      text: name,
      createdAt: Date.now(),
      order: Number.isFinite(groupOrder) ? groupOrder : getOrderForNewItem([]),
      parentId: null,
      kind: "group",
      repeat: NO_REPEAT,
    });
    batch.update(doc(db, "todos", movingItem.id), {
      parentId: groupRef.id,
      order: getOrderForNewItem([]),
    });
    setMovingId(null);
    await batch.commit();
  };

  const saveEdit = async (text: string, repeat: Repeat) => {
    if (!editingItem) return;
    const id = editingItem.id;
    setEditingId(null);
    await updateDoc(doc(db, "todos", id), { text, repeat });
  };

  const handleDragEnd = useCallback(
    async ({
      data,
      fromIndex,
      toIndex,
    }: {
      data: TodoItem[];
      fromIndex: number;
      toIndex: number;
    }) => {
      if (fromIndex === toIndex) return;
      const moved = data[toIndex];
      const prevOrder = toIndex > 0 ? data[toIndex - 1].order : null;
      const nextOrder = toIndex < data.length - 1 ? data[toIndex + 1].order : null;
      const newOrder = getOrderBetween(prevOrder, nextOrder);
      await updateDoc(doc(db, "todos", moved.id), { order: newOrder });
    },
    []
  );

  const renderRow = useCallback(
    (item: TodoItem) => {
      const actions: RowAction[] = [
        ...(item.kind === "task"
          ? [{ label: "Move", color: "#8e8e93", onPress: () => setMovingId(item.id) }]
          : []),
        { label: "Delete", color: "#ff3b30", onPress: () => removeItem(item) },
      ];
      const subtitle = subtitleFor(item);

      const marker = item.done ? (
        <View style={[styles.checkbox, styles.checkboxDone]}>
          <Text style={styles.checkmark}>✓</Text>
        </View>
      ) : item.kind === "group" ? (
        <ProgressPie progress={item.progress} />
      ) : (
        <View style={styles.checkbox} />
      );

      const faded = item.done || item.upcoming;
      const label = (
        <View style={styles.labelWrap}>
          <Text
            style={[
              styles.todoText,
              item.done && styles.todoDone,
              item.upcoming && styles.todoUpcoming,
            ]}
          >
            {item.text}
          </Text>
          {subtitle && (
            <Text
              style={[
                styles.subtitle,
                faded && styles.subtitleDone,
                // Orange only while it still needs doing today; gray once done.
                subtitle.tone === "tight" && !item.done && styles.toneTight,
                subtitle.tone === "behind" && styles.toneBehind,
              ]}
            >
              {subtitle.text}
            </Text>
          )}
        </View>
      );

      return (
        <SwipeRow actions={actions} openRowRef={openRowRef}>
          {item.kind === "group" ? (
            // Tapping anywhere on a group opens it.
            <TouchableOpacity
              style={styles.todoRow}
              onPress={() => setOpenGroupId(item.id)}
              activeOpacity={0.6}
            >
              <View style={styles.markerWrap}>{marker}</View>
              {label}
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ) : (
            // Tasks: tap the circle to check off, tap the text to edit.
            // Upcoming tasks can't be checked off until they're due.
            <View style={styles.todoRow}>
              <TouchableOpacity
                style={[styles.markerWrap, item.upcoming && styles.markerUpcoming]}
                onPress={() => toggleTodo(item)}
                disabled={item.upcoming}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
                activeOpacity={0.6}
              >
                {marker}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.labelTouch}
                onPress={() => setEditingId(item.id)}
                activeOpacity={0.6}
              >
                {label}
              </TouchableOpacity>
            </View>
          )}
        </SwipeRow>
      );
    },
    [removeItem, toggleTodo]
  );

  const renderUndoneItem = useCallback<SortableGridRenderItem<TodoItem>>(
    ({ item }) => renderRow(item),
    [renderRow]
  );

  if (showStats) {
    return (
      <Stats
        items={items}
        completions={completions}
        today={today}
        onBack={() => setShowStats(false)}
      />
    );
  }

  const hasItems = levelItems.length > 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          {openGroup ? (
            <>
              <TouchableOpacity
                onPress={() => setOpenGroupId(null)}
                hitSlop={10}
                style={styles.backButton}
              >
                <Text style={styles.backText}>‹ Flow</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.titleRow}
                onPress={() => setEditingId(openGroup.id)}
                activeOpacity={0.6}
              >
                <View style={styles.titleWrap}>
                  <Text style={styles.groupTitle}>{openGroup.text}</Text>
                  {(() => {
                    const sub = subtitleFor(openGroup);
                    return sub ? (
                      <Text
                        style={[
                          styles.titleSubtitle,
                          sub.tone === "tight" && !openGroup.done && styles.toneTight,
                          sub.tone === "behind" && styles.toneBehind,
                        ]}
                      >
                        {sub.text}
                      </Text>
                    ) : null;
                  })()}
                  {openGroup.repeat.type !== "none" && openGroup.childTotal > 0 && (
                    <Text style={styles.titleSubtitle}>
                      {openGroup.childDone} of {openGroup.childTotal} done
                      {openGroup.repeat.type === "quota" ? " today" : ""}
                    </Text>
                  )}
                </View>
                <ProgressPie progress={openGroup.progress} size={34} />
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.titleRow}>
              <Text style={styles.title}>Flow</Text>
              <TouchableOpacity onPress={() => setShowStats(true)} hitSlop={10}>
                <Text style={styles.statsLink}>Stats</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={openGroup ? "Add a subtask..." : "Add a task..."}
              placeholderTextColor="#9a9a9a"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={addTodo}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.addButton, !input.trim() && styles.addButtonDisabled]}
              onPress={addTodo}
              disabled={!input.trim()}
              activeOpacity={0.8}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>

          {!hasItems ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                {openGroup ? "No subtasks yet" : "Nothing here yet"}
              </Text>
              <Text style={styles.emptyStateSubtext}>
                {openGroup ? "Add the first one above" : "Add your first task above"}
              </Text>
            </View>
          ) : (
            <Animated.ScrollView
              ref={scrollRef}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Undone items: press and hold to drag and reorder. */}
              <Sortable.Grid
                key={openGroup ? openGroup.id : "main"}
                columns={1}
                data={undoneTodos}
                keyExtractor={(item) => item.id}
                renderItem={renderUndoneItem}
                rowGap={1}
                onDragEnd={handleDragEnd}
                scrollableRef={scrollRef}
                showDropIndicator
              />

              {/* Upcoming: repeating tasks whose first due date is still ahead. */}
              {upcomingTodos.length > 0 && (
                <View style={styles.upcomingSection}>
                  <Text style={styles.sectionLabel}>Upcoming</Text>
                  {upcomingTodos.map((item) => (
                    <React.Fragment key={item.id}>{renderRow(item)}</React.Fragment>
                  ))}
                </View>
              )}

              {/* Done items: not draggable, sorted by completion time. */}
              {doneTodos.length > 0 && (
                <View style={styles.doneSection}>
                  {doneTodos.map((item) => (
                    <React.Fragment key={item.id}>{renderRow(item)}</React.Fragment>
                  ))}
                </View>
              )}
            </Animated.ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>

      <MoveSheet
        visible={!!movingItem}
        taskText={movingItem?.text ?? ""}
        currentParentId={movingItem?.parentId ?? null}
        groups={groups}
        onMoveTo={moveTo}
        onNewGroup={moveToNewGroup}
        onClose={() => setMovingId(null)}
      />
      <EditSheet
        visible={!!editingItem}
        isGroup={editingItem?.kind === "group"}
        lockedBy={
          editingItem?.inheritsRepeat && editingItem.parentId
            ? itemsById.get(editingItem.parentId)?.text ?? null
            : null
        }
        text={editingItem?.text ?? ""}
        repeat={editingItem?.repeat ?? NO_REPEAT}
        today={today}
        onSave={saveEdit}
        onClose={() => setEditingId(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fafafa" },
  flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 20 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#111",
    letterSpacing: -0.5,
  },
  statsLink: { fontSize: 16, color: "#007aff", fontWeight: "600" },
  backButton: { marginTop: 8, alignSelf: "flex-start" },
  backText: { fontSize: 17, color: "#007aff" },
  titleWrap: { flex: 1, marginRight: 12 },
  groupTitle: { fontSize: 28, fontWeight: "800", color: "#111", letterSpacing: -0.5 },
  titleSubtitle: { fontSize: 14, color: "#888", marginTop: 2 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  input: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e2e2",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 10,
    fontSize: 16,
    color: "#111",
  },
  addButton: {
    backgroundColor: "#111",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonDisabled: {
    backgroundColor: "#c9c9c9",
  },
  addButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  listContent: { paddingBottom: 24 },
  doneSection: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  todoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    backgroundColor: "#fafafa",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  markerWrap: { marginRight: 12 },
  labelTouch: { flex: 1 },
  labelWrap: { flex: 1 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#ccc",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxDone: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  checkmark: { color: "#fff", fontSize: 13, fontWeight: "700" },
  todoText: { fontSize: 16, color: "#111", flexShrink: 1 },
  todoDone: { textDecorationLine: "line-through", color: "#aaa" },
  subtitle: { fontSize: 13, color: "#888", marginTop: 2 },
  subtitleDone: { color: "#bbb" },
  toneTight: { color: "#d97706", fontWeight: "600" },
  toneBehind: { color: "#dc2626", fontWeight: "600" },
  todoUpcoming: { color: "#999" },
  markerUpcoming: { opacity: 0.4 },
  upcomingSection: { marginTop: 16 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#888",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  chevron: { fontSize: 24, color: "#bbb", marginLeft: 8, marginTop: -2 },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 80,
  },
  emptyStateText: { fontSize: 17, fontWeight: "600", color: "#777" },
  emptyStateSubtext: { fontSize: 14, color: "#aaa", marginTop: 4 },
});
