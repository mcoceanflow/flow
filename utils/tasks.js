// app/utils/tasks.js
import dayjs from 'dayjs';

export const getWeeklyProgress = (task) => {
  if (!task.recurring || task.recurring.frequency !== 'weekly' || !task.recurring.goal) return null;

  const weekStart = dayjs().startOf('week');
  const weekEnd = dayjs().endOf('week');

  const doneThisWeek = task.completedDates.filter(date =>
    dayjs(date).isAfter(weekStart.subtract(1, 'day')) && dayjs(date).isBefore(weekEnd.add(1, 'day'))
  ).length;

  return { done: doneThisWeek, goal: task.recurring.goal };
};

export const getMonthlyProgress = (task) => {
  if (!task.recurring || task.recurring.frequency !== 'monthly') return null;

  const monthStart = dayjs().startOf('month');
  const monthEnd = dayjs().endOf('month');

  const doneThisMonth = task.completedDates.filter(date =>
    dayjs(date).isAfter(monthStart.subtract(1, 'day')) && dayjs(date).isBefore(monthEnd.add(1, 'day'))
  ).length;

  // For monthly tasks, goal = 1 by default
  return { done: doneThisMonth, goal: 1 };
};
