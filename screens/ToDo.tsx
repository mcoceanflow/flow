// Screens/ToDo.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { useAnimatedRef } from "react-native-reanimated";
import Sortable, { type SortableGridRenderItem } from "react-native-sortables";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { getOrderBetween, getOrderForNewItem } from "../utils/order";

type Todo = {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
  order: number;
  completedAt: number | null;
};

export default function ToDo() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  useEffect(() => {
    // No orderBy here on purpose: undone and done items need two different
    // sort orders, so we fetch everything once and split/sort client-side.
    const unsubscribe = onSnapshot(collection(db, "todos"), (snapshot) => {
      const items: Todo[] = snapshot.docs.map((d) => {
        const data = d.data() as Omit<Todo, "id">;
        return {
          id: d.id,
          ...data,
          // Fallback for any pre-existing docs written before `order` existed.
          order: typeof data.order === "number" ? data.order : Number.POSITIVE_INFINITY,
          completedAt: data.completedAt ?? null,
        };
      });
      setTodos(items);
    });
    return unsubscribe;
  }, []);

  const undoneTodos = useMemo(
    () =>
      todos
        .filter((t) => !t.done)
        .sort((a, b) => a.order - b.order),
    [todos]
  );

  const doneTodos = useMemo(
    () =>
      todos
        .filter((t) => t.done)
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
    [todos]
  );

  const addTodo = async () => {
    if (!input.trim()) return;
    const newOrder = getOrderForNewItem(undoneTodos.map((t) => t.order));
    await addDoc(collection(db, "todos"), {
      text: input.trim(),
      done: false,
      createdAt: Date.now(),
      order: newOrder,
      completedAt: null,
    });
    setInput("");
  };

  const toggleTodo = async (id: string, done: boolean) => {
    // Un-completing an item never touches `order`, so it reappears exactly
    // where it was before it was marked done.
    await updateDoc(doc(db, "todos", id), {
      done: !done,
      completedAt: !done ? Date.now() : null,
    });
  };

  const removeTodo = async (id: string) => {
    await deleteDoc(doc(db, "todos", id));
  };

  const handleDragEnd = useCallback(
    async ({
      data,
      fromIndex,
      toIndex,
    }: {
      data: Todo[];
      fromIndex: number;
      toIndex: number;
    }) => {
      if (fromIndex === toIndex) return;
      const moved = data[toIndex];
      const prevOrder = toIndex > 0 ? data[toIndex - 1].order : null;
      const nextOrder =
        toIndex < data.length - 1 ? data[toIndex + 1].order : null;
      const newOrder = getOrderBetween(prevOrder, nextOrder);
      await updateDoc(doc(db, "todos", moved.id), { order: newOrder });
    },
    []
  );

  const renderUndoneItem = useCallback<SortableGridRenderItem<Todo>>(
    ({ item }) => (
      <View style={styles.todoRow}>
        <TouchableOpacity
          style={styles.todoTextWrap}
          onPress={() => toggleTodo(item.id, item.done)}
          activeOpacity={0.6}
        >
          <View style={styles.checkbox}>
            <Text> </Text>
          </View>
          <Text style={styles.todoText}>{item.text}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => removeTodo(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.deleteText}>✕</Text>
        </TouchableOpacity>
      </View>
    ),
    []
  );

  const hasItems = todos.length > 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Flow</Text>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Add a task..."
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
              <Text style={styles.emptyStateText}>Nothing here yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Add your first task above
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
                columns={1}
                data={undoneTodos}
                keyExtractor={(item) => item.id}
                renderItem={renderUndoneItem}
                rowGap={1}
                onDragEnd={handleDragEnd}
                scrollableRef={scrollRef}
                showDropIndicator
              />

              {/* Done items: not draggable, sorted by completion time, tap to undo. */}
              {doneTodos.length > 0 && (
                <View style={styles.doneSection}>
                  {doneTodos.map((item) => (
                    <View key={item.id} style={styles.todoRow}>
                      <TouchableOpacity
                        style={styles.todoTextWrap}
                        onPress={() => toggleTodo(item.id, item.done)}
                        activeOpacity={0.6}
                      >
                        <View style={[styles.checkbox, styles.checkboxDone]}>
                          <Text style={styles.checkmark}>✓</Text>
                        </View>
                        <Text style={[styles.todoText, styles.todoDone]}>
                          {item.text}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => removeTodo(item.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.deleteText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </Animated.ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fafafa" },
  flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 20 },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#111",
    marginTop: 12,
    marginBottom: 24,
    letterSpacing: -0.5,
  },
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
    justifyContent: "space-between",
    paddingVertical: 14,
    backgroundColor: "#fafafa",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  todoTextWrap: { flex: 1, flexDirection: "row", alignItems: "center" },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#ccc",
    marginRight: 12,
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
  deleteText: { color: "#c00", fontSize: 16, paddingHorizontal: 8 },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 80,
  },
  emptyStateText: { fontSize: 17, fontWeight: "600", color: "#777" },
  emptyStateSubtext: { fontSize: 14, color: "#aaa", marginTop: 4 },
});
