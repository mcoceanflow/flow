// App.tsx
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import ToDo from "./screens/ToDo";

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ToDo />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
