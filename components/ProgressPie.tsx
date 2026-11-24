// components/ProgressPie.tsx
//
// A circle that fills like a pie chart, clockwise from 12 o'clock.
// Built from plain Views (two clipped, rotated half-discs) so it needs no
// native drawing library and works without a new dev build.

import React from "react";
import { View, StyleSheet } from "react-native";

export default function ProgressPie({
  progress,
  size = 22,
  color = "#111",
  ringColor = "#ccc",
}: {
  progress: number; // 0..1
  size?: number;
  color?: string;
  ringColor?: string;
}) {
  const p = Math.max(0, Math.min(1, progress));
  const inset = 3;
  const s = size - inset * 2; // pie diameter inside the ring
  const half = s / 2;

  // Right half shows 0–180°, left half shows 180–360°.
  const rightDeg = Math.min(p, 0.5) * 360;
  const leftDeg = Math.max(p - 0.5, 0) * 360;

  return (
    <View
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2, borderColor: ringColor },
      ]}
    >
      {p > 0 && (
        <View style={{ width: s, height: s }}>
          {/* Right clip: a left half-disc rotated into view. */}
          <View style={[styles.clip, { left: half, width: half, height: s }]}>
            <View
              style={{
                position: "absolute",
                left: -half,
                width: s,
                height: s,
                transform: [{ rotate: `${rightDeg}deg` }],
              }}
            >
              <View
                style={{
                  width: half,
                  height: s,
                  backgroundColor: color,
                  borderTopLeftRadius: half,
                  borderBottomLeftRadius: half,
                }}
              />
            </View>
          </View>
          {/* Left clip: a right half-disc rotated into view. */}
          {leftDeg > 0 && (
            <View style={[styles.clip, { left: 0, width: half, height: s }]}>
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  width: s,
                  height: s,
                  transform: [{ rotate: `${leftDeg}deg` }],
                }}
              >
                <View
                  style={{
                    position: "absolute",
                    left: half,
                    width: half,
                    height: s,
                    backgroundColor: color,
                    borderTopRightRadius: half,
                    borderBottomRightRadius: half,
                  }}
                />
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  clip: {
    position: "absolute",
    top: 0,
    overflow: "hidden",
  },
});
