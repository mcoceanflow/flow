// app/add-task.js
import { useRouter } from 'expo-router';
import { useContext, useState } from 'react';
import { Button, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { TasksContext } from '../context/TasksContext';

const frequencies = ['daily', 'weekly', 'monthly'];
const daysOfWeekLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AddTaskScreen() {
  const { addTask } = useContext(TasksContext);
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [recurring, setRecurring] = useState(null);
  const [goal, setGoal] = useState('');
  const [daysOfWeek, setDaysOfWeek] = useState([]);

  const toggleDay = (dayIndex) => {
    setDaysOfWeek(prev =>
      prev.includes(dayIndex) ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex]
    );
  };

  const handleSubmit = () => {
    if (!title.trim()) return alert('Please enter a task title.');

    addTask({
      title,
      recurring: recurring
        ? {
            frequency: recurring,
            goal: recurring === 'weekly' ? parseInt(goal) || 1 : undefined,
            daysOfWeek: recurring === 'weekly' ? daysOfWeek : undefined,
          }
        : null,
      createdAt: new Date().toISOString(),
    });

    // Reset form
    setTitle('');
    setRecurring(null);
    setGoal('');
    setDaysOfWeek([]);
    router.replace('/'); // go back to HomeScreen
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Task Title:</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., Drink Water"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.label}>Recurring:</Text>
      <View style={styles.freqContainer}>
        {frequencies.map(freq => (
          <TouchableOpacity
            key={freq}
            style={[styles.freqButton, recurring === freq && styles.freqButtonSelected]}
            onPress={() => setRecurring(recurring === freq ? null : freq)}
          >
            <Text style={styles.freqText}>{freq}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {recurring === 'weekly' && (
        <>
          <Text style={styles.label}>Goal (times per week):</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={goal}
            onChangeText={setGoal}
            placeholder="3"
          />

          <Text style={styles.label}>Days of Week:</Text>
          <View style={styles.daysContainer}>
            {daysOfWeekLabels.map((day, index) => (
              <TouchableOpacity
                key={day}
                style={[styles.dayButton, daysOfWeek.includes(index) && styles.dayButtonSelected]}
                onPress={() => toggleDay(index)}
              >
                <Text>{day}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <Button title="Add Task" onPress={handleSubmit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  label: { fontWeight: 'bold', marginTop: 15 },
  input: { borderWidth: 1, padding: 10, borderRadius: 5, marginVertical: 5 },
  freqContainer: { flexDirection: 'row', marginVertical: 10 },
  freqButton: { padding: 10, marginRight: 10, borderWidth: 1, borderRadius: 5 },
  freqButtonSelected: { backgroundColor: '#87cefa' },
  freqText: { textTransform: 'capitalize' },
  daysContainer: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 10 },
  dayButton: { padding: 10, margin: 5, borderWidth: 1, borderRadius: 5 },
  dayButtonSelected: { backgroundColor: '#90ee90' },
});
