// App.tsx
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import ToDo from "./screens/ToDo";

export default function App() {
  return (
    <SafeAreaProvider>
      <ToDo />
    </SafeAreaProvider>
  );
}
