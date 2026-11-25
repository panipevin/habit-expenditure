import type {
  CalendarEvent,
  DailyTask,
  Expense,
  Habit,
  InAppNotification,
  NotificationPreferences,
  WidgetConfig,
} from '../types';

export const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'tasks', title: 'Daily Tasks & Evening Cutoff', visible: true, size: 'wide' },
  { id: 'habits', title: 'Habit Streaks & Milestones', visible: true, size: 'compact' },
  { id: 'calendar', title: 'Upcoming Meetings & Deadlines', visible: true, size: 'compact' },
  { id: 'family', title: 'Connected Family Accounts', visible: true, size: 'wide' },
  { id: 'expenses', title: 'Personal Budget Snapshot', visible: true, size: 'compact' },
  { id: 'analytics', title: '14-Day Momentum', visible: true, size: 'compact' },
];

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  pushEnabled: true,
  urgentDeadlines: true,
  eveningCutoffReminder: true,
  eveningCutoffHour: 21,
  streakRiskAlerts: true,
  teamMentions: true,
  budgetThresholdAlerts: true,
};

export function createEmptyWorkspaceData() {
  const tasks: DailyTask[] = [];
  const habits: Habit[] = [];
  const expenses: Expense[] = [];
  const calendarEvents: CalendarEvent[] = [];
  const notifications: InAppNotification[] = [];

  return { tasks, habits, expenses, calendarEvents, notifications };
}
