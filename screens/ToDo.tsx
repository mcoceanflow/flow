// Screens/ToDo.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebaseConfig";

type Todo = {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
};

export default function ToDo() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState("");

  // Track open Swipeable rows so we can auto-close a previous row
  // when a new one is swiped open (matches iOS Mail behavior).
  const swipeableRefs = useRef<Map<string, Swipeable | null>>(new Map());
  const openRowId = useRef<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "todos"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Todo[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Todo, "id">),
      }));
      setTodos(items);
    });
    return unsubscribe;
  }, []);

  const addTodo = async () => {
    if (!input.trim()) return;
    await addDoc(collection(db, "todos"), {
      text: input.trim(),
      done: false,
      createdAt: Date.now(),
    });
    setInput("");
  };

  const toggleTodo = async (id: string, done: boolean) => {
    await updateDoc(doc(db, "todos", id), { done: !done });
  };

  const removeTodo = async (id: string) => {
    swipeableRefs.current.get(id)?.close();
    await deleteDoc(doc(db, "todos", id));
    swipeableRefs.current.delete(id);
  };

  const closeOtherRows = (id: string) => {
    if (openRowId.current && openRowId.current !== id) {
      swipeableRefs.current.get(openRowId.current)?.close();
    }
    openRowId.current = id;
  };

  const renderRightActions = (
    id: string,
    progress: Animated.AnimatedInterpolation<number>
  ) => {
    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [100, 0],
      extrapolate: "clamp",
    });
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.deleteAction}
        onPress={() => removeTodo(id)}
      >
        <Animated.Text
          style={[styles.deleteActionText, { transform: [{ translateX }] }]}
          numberOfLines={1}
        >
          Delete
        </Animated.Text>
      </TouchableOpacity>
    );
  };

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

          <FlatList
            data={todos}
            keyExtractor={(item) => item.id}
            contentContainerStyle={
              todos.length === 0 ? styles.emptyListContent : styles.listContent
            }
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>Nothing here yet</Text>
                <Text style={styles.emptyStateSubtext}>
                  Add your first task above
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <Swipeable
                ref={(ref) => {
                  swipeableRefs.current.set(item.id, ref);
                }}
                renderRightActions={(progress) =>
                  renderRightActions(item.id, progress)
                }
                overshootRight={false}
                rightThreshold={40}
                onSwipeableWillOpen={() => closeOtherRows(item.id)}
              >
                <View style={styles.todoRow}>
                  <TouchableOpacity
                    style={styles.todoTextWrap}
                    onPress={() => toggleTodo(item.id, item.done)}
                    activeOpacity={0.6}
                  >
                    <View style={[styles.checkbox, item.done && styles.checkboxDone]}>
                      {item.done && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={[styles.todoText, item.done && styles.todoDone]}>
                      {item.text}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Swipeable>
            )}
          />
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
  emptyListContent: { flexGrow: 1, paddingBottom: 24 },
  separator: { height: 1, backgroundColor: "#eee" },
  todoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    backgroundColor: "#fafafa",
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
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 80,
  },
  emptyStateText: { fontSize: 17, fontWeight: "600", color: "#777" },
  emptyStateSubtext: { fontSize: 14, color: "#aaa", marginTop: 4 },
  deleteAction: {
    backgroundColor: "#c00",
    justifyContent: "center",
    alignItems: "center",
    width: 100,
  },
  deleteActionText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
});
