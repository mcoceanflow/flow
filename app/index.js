// app/index.js
import dayjs from 'dayjs';
import { useContext } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import 'react-native-get-random-values';
import { TasksContext } from '../context/TasksContext';
import { getMonthlyProgress, getWeeklyProgress } from '../utils/tasks';

export default function HomeScreen() {
  const { tasks, markCompleted, unmarkCompleted, deleteTask } = useContext(TasksContext);
  const today = dayjs().format('YYYY-MM-DD');
  const dayOfWeek = dayjs().day(); // 0 = Sunday

  // Filter tasks for today
  const todayTasks = tasks.filter(task => {
    if (!task.recurring) return true; // one-time tasks
    if (task.recurring.frequency === 'daily') return true;
    if (task.recurring.frequency === 'weekly') {
      return task.recurring.daysOfWeek?.includes(dayOfWeek);
    }
    if (task.recurring.frequency === 'monthly') {
      return dayjs().date() === dayjs(task.createdAt).date(); // repeat on same day of month
    }
    return false;
  });

  const handleComplete = (taskId) => {
    markCompleted(taskId, today);
  };

  const handleUncomplete = (taskId) => {
    unmarkCompleted(taskId, today);
  };

  const handleDelete = (taskId) => {
    deleteTask(taskId);
  };

  const renderItem = ({ item }) => {
    const completedToday = item.completedDates.includes(today);

    // Calculate progress
    let progress = null;
    if (item.recurring?.frequency === 'weekly') {
      const { done, goal } = getWeeklyProgress(item);
      progress = `${done}/${goal}`;
    } else if (item.recurring?.frequency === 'monthly') {
      const { done, goal } = getMonthlyProgress(item);
      progress = `${done}/${goal}`;
    }

    return (
      <View style={styles.taskContainer}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.taskTitle, completedToday && styles.completed]}>
            {item.title} {progress && `(${progress})`}
          </Text>
          {progress && (
            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${(parseInt(progress.split('/')[0]) / parseInt(progress.split('/')[1])) * 100}%` }
                ]}
              />
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {!completedToday ? (
            <TouchableOpacity style={styles.completeButton} onPress={() => handleComplete(item.id)}>
              <Text style={{ color: 'white' }}>Complete</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.incompleteButton} onPress={() => handleUncomplete(item.id)}>
              <Text style={{ color: 'white' }}>Mark Incomplete</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
            <Text style={{ color: 'white' }}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Tasks for Today:</Text>
      {todayTasks.length === 0 ? (
        <Text>No tasks for today!</Text>
      ) : (
        <FlatList
          data={todayTasks}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  taskContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    marginVertical: 5,
    borderWidth: 1,
    borderRadius: 5,
  },
  taskTitle: { fontSize: 16 },
  completed: { textDecorationLine: 'line-through', color: 'gray' },
  completeButton: {
    backgroundColor: '#4caf50',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  incompleteButton: {
    backgroundColor: '#f39c12',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    marginLeft: 5,
  },
  progressBarBackground: {
    height: 6,
    width: '100%',
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    marginTop: 4,
  },
  progressBarFill: {
    height: 6,
    backgroundColor: '#4caf50',
    borderRadius: 3,
  },
});
