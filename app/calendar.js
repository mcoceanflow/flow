// app/calendar.js
import React, { useContext, useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { TasksContext } from '../context/TasksContext';
import { Calendar } from 'react-native-calendars';
import dayjs from 'dayjs';

export default function CalendarScreen() {
  const { tasks } = useContext(TasksContext);
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [markedDates, setMarkedDates] = useState({});

  // Mark dates with completed tasks
  useEffect(() => {
    const marks = {};
    tasks.forEach(task => {
      task.completedDates?.forEach(date => {
        if (!marks[date]) {
          marks[date] = { marked: true, dots: [{ color: 'green' }] };
        } else {
          marks[date].dots.push({ color: 'green' });
        }
      });
    });
    setMarkedDates(marks);
  }, [tasks]);

  // Tasks completed on selected date
  const tasksForDate = tasks.filter(task =>
    task.completedDates?.includes(selectedDate)
  );

  return (
    <View style={styles.container}>
      <Calendar
        onDayPress={day => setSelectedDate(day.dateString)}
        markedDates={{
          ...markedDates,
          [selectedDate]: { ...(markedDates[selectedDate] || {}), selected: true, selectedColor: '#87cefa' },
        }}
        markingType={'multi-dot'}
      />

      <Text style={styles.header}>Tasks Completed on {selectedDate}:</Text>
      {tasksForDate.length === 0 ? (
        <Text>No tasks completed.</Text>
      ) : (
        <FlatList
          data={tasksForDate}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <Text style={styles.task}>{item.title}</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
  header: { fontSize: 18, fontWeight: 'bold', marginVertical: 10 },
  task: { fontSize: 16, paddingVertical: 5 },
});
