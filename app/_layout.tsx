// app/_layout.tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { TasksProvider } from '../context/TasksContext';
import { Ionicons } from '@expo/vector-icons';

export default function Layout() {
  return (
    <TasksProvider>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: '#87cefa' },
          headerTintColor: 'white',
          headerTitleStyle: { fontWeight: 'bold' },
          tabBarActiveTintColor: '#4caf50',
          tabBarInactiveTintColor: 'gray',
          tabBarStyle: { backgroundColor: 'white' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="add-task"
          options={{
            title: 'Add Task',
            tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Calendar',
            tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
          }}
        />
      </Tabs>
    </TasksProvider>
  );
}
