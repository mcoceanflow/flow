// components/SwipeRow.tsx
//
// Wraps a row so it can be swiped left to reveal action buttons (e.g. "Move"
// and "Delete"), like iOS Mail. Only one row stays open at a time: opening a
// row closes the previous one.

import React, { useRef } from "react";
import { Text, TouchableOpacity, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

export type RowAction = {
  label: string;
  color: string;
  onPress: () => void;
};

const ACTION_WIDTH = 80;

// The buttons revealed behind the row. They slide in from the right edge in
// step with the finger.
function RowActions({
  actions,
  translation,
  close,
}: {
  actions: RowAction[];
  translation: SharedValue<number>;
  close: () => void;
}) {
  const width = ACTION_WIDTH * actions.length;
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translation.value + width }],
  }));
  return (
    <Animated.View style={[styles.actions, { width }, animatedStyle]}>
      {actions.map((a) => (
        <TouchableOpacity
          key={a.label}
          style={[styles.action, { backgroundColor: a.color }]}
          onPress={() => {
            close();
            a.onPress();
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.actionText}>{a.label}</Text>
        </TouchableOpacity>
      ))}
    </Animated.View>
  );
}

export default function SwipeRow({
  actions,
  openRowRef,
  children,
}: {
  actions: RowAction[];
  openRowRef: React.MutableRefObject<SwipeableMethods | null>;
  children: React.ReactNode;
}) {
  const swipeableRef = useRef<SwipeableMethods>(null);
  const width = ACTION_WIDTH * actions.length;
  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      friction={1.5}
      rightThreshold={width / 2}
      overshootRight={false}
      onSwipeableWillOpen={() => {
        if (openRowRef.current && openRowRef.current !== swipeableRef.current) {
          openRowRef.current.close();
        }
        openRowRef.current = swipeableRef.current;
      }}
      onSwipeableClose={() => {
        if (openRowRef.current === swipeableRef.current) {
          openRowRef.current = null;
        }
      }}
      renderRightActions={(_progress, translation) => (
        <RowActions
          actions={actions}
          translation={translation}
          close={() => swipeableRef.current?.close()}
        />
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row" },
  action: { width: ACTION_WIDTH, justifyContent: "center", alignItems: "center" },
  actionText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
