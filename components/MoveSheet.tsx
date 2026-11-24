// components/MoveSheet.tsx
//
// Bottom sheet for moving a task into a group, out to the main list, or into
// a brand-new group.

import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

export default function MoveSheet({
  visible,
  taskText,
  currentParentId,
  groups,
  onMoveTo,
  onNewGroup,
  onClose,
}: {
  visible: boolean;
  taskText: string;
  currentParentId: string | null;
  groups: { id: string; text: string }[];
  onMoveTo: (groupId: string | null) => void;
  onNewGroup: (name: string) => void;
  onClose: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (visible) {
      setNewName("");
      setCreating(false);
    }
  }, [visible]);

  const submitNewGroup = () => {
    if (!newName.trim()) return;
    onNewGroup(newName.trim());
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      allowSwipeDismissal
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Text style={styles.headerButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Move</Text>
          <View style={styles.headerSpacer} />
        </View>
        <Text style={styles.taskText} numberOfLines={2}>
          {taskText}
        </Text>

        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {currentParentId !== null && (
            <TouchableOpacity style={styles.option} onPress={() => onMoveTo(null)}>
              <Text style={styles.optionText}>Main list</Text>
            </TouchableOpacity>
          )}

          {groups
            .filter((g) => g.id !== currentParentId)
            .map((g) => (
              <TouchableOpacity key={g.id} style={styles.option} onPress={() => onMoveTo(g.id)}>
                <Text style={styles.optionText}>{g.text}</Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}

          {creating ? (
            <View style={styles.newGroupRow}>
              <TextInput
                style={styles.input}
                placeholder="Group name"
                placeholderTextColor="#9a9a9a"
                value={newName}
                onChangeText={setNewName}
                onSubmitEditing={submitNewGroup}
                returnKeyType="done"
                autoFocus
              />
              <TouchableOpacity
                style={[styles.createButton, !newName.trim() && styles.createButtonDisabled]}
                onPress={submitNewGroup}
                disabled={!newName.trim()}
              >
                <Text style={styles.createButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.option} onPress={() => setCreating(true)}>
              <Text style={[styles.optionText, styles.newGroupText]}>+ New group…</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  headerSpacer: { width: 50 },
  taskText: { fontSize: 15, color: "#777", paddingHorizontal: 20, marginBottom: 12 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  optionText: { fontSize: 16, color: "#111" },
  newGroupText: { color: "#007aff" },
  chevron: { fontSize: 22, color: "#bbb" },
  newGroupRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
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
  createButton: {
    backgroundColor: "#111",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  createButtonDisabled: { backgroundColor: "#c9c9c9" },
  createButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
