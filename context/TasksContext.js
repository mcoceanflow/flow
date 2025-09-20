// context/TasksContext.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid'; // generate unique IDs


export const TasksContext = createContext();

export const TasksProvider = ({ children }) => {
  const [tasks, setTasks] = useState([]);

  // Load tasks from AsyncStorage
  useEffect(() => {
    const loadTasks = async () => {
      try {
        const json = await AsyncStorage.getItem('@tasks');
        if (json != null) setTasks(JSON.parse(json));
      } catch (e) {
        console.error('Failed to load tasks', e);
      }
    };
    loadTasks();
  }, []);

  // Save tasks to AsyncStorage whenever tasks change
  useEffect(() => {
    const saveTasks = async () => {
      try {
        await AsyncStorage.setItem('@tasks', JSON.stringify(tasks));
      } catch (e) {
        console.error('Failed to save tasks', e);
      }
    };
    saveTasks();
  }, [tasks]);

  // Add a new task
  const addTask = (task) => {
    const newTask = {
      id: uuidv4(),
      title: task.title,
      recurring: task.recurring || null,
      createdAt: task.createdAt || new Date().toISOString(),
      completedDates: [],
    };
    setTasks(prev => [...prev, newTask]);
  };

  // Mark a task complete for a given date
  const markCompleted = (taskId, date) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === taskId && !task.completedDates.includes(date)
          ? { ...task, completedDates: [...task.completedDates, date] }
          : task
      )
    );
  };

  // Remove a completed date from a task
  const unmarkCompleted = (taskId, date) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === taskId
          ? { ...task, completedDates: task.completedDates.filter(d => d !== date) }
          : task
      )
    );
  };

  // Delete a task
  const deleteTask = (taskId) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  };

  return (
    <TasksContext.Provider value={{ tasks, addTask, markCompleted, unmarkCompleted, deleteTask }}>
      {children}
    </TasksContext.Provider>
  );
};
