export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type ExpenseCategory = string;

export type AppSection =
  | 'dashboard'
  | 'tasks'
  | 'habits'
  | 'family'
  | 'calendar'
  | 'expenses'
  | 'analytics'
  | 'settings';

export interface DailyTask {
  id: string;
  ownerId: string;
  title: string;
  notes?: string;
  category: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:MM
  assignedBeforeNight: boolean;
  reminderEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Habit {
  id: string;
  ownerId: string;
  name: string;
  category: string;
  reminderTime: string;
  completedDates: string[]; // YYYY-MM-DD sorted ascending
  graceDates: string[]; // YYYY-MM-DD protected via grace period
  graceTokensRemaining: number;
  isPaused: boolean;
  pauseReason?: string;
  pausedSince?: string; // YYYY-MM-DD
  claimedMilestones: number[]; // e.g., [7, 30, 100]
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  ownerId: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string; // YYYY-MM-DD
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export type BudgetLimits = Record<ExpenseCategory, number>;

export interface ConnectedViewer {
  uid: string;
  name: string;
}

export interface SharedAccountProfile {
  ownerId: string;
  displayName: string;
  expenseCategories: ExpenseCategory[];
  budgetLimits: BudgetLimits;
  viewerIds: string[];
  viewerNames: Record<string, string>;
  updatedAt: string;
}

export interface ShareInvite {
  code: string;
  creatorId: string;
  creatorName: string;
  status: 'open' | 'accepted';
  acceptedByUid?: string;
  acceptedByName?: string;
  createdAt: string;
  updatedAt: string;
}

export type CalendarEventType = 'meeting' | 'deadline' | 'reminder';

export interface CalendarEvent {
  id: string;
  ownerId: string;
  title: string;
  eventType: CalendarEventType;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime?: string; // HH:MM
  urgent: boolean;
  reminderMinutes: number;
  participants: string[];
}

export type WidgetId =
  | 'tasks'
  | 'habits'
  | 'calendar'
  | 'family'
  | 'expenses'
  | 'analytics';

export interface WidgetConfig {
  id: WidgetId;
  title: string;
  visible: boolean;
  size: 'compact' | 'wide';
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  urgentDeadlines: boolean;
  eveningCutoffReminder: boolean;
  eveningCutoffHour: number; // 17..23 (default 21 = 9:00 PM)
  streakRiskAlerts: boolean;
  teamMentions: boolean;
  budgetThresholdAlerts: boolean;
}

export interface InAppNotification {
  id: string;
  title: string;
  message: string;
  category: 'deadline' | 'streak' | 'family' | 'budget' | 'sync';
  timestamp: string;
  read: boolean;
}

export interface SyncQueueItem {
  id: string;
  entity: 'task' | 'habit' | 'expense' | 'sharing' | 'calendarEvent';
  action: 'upsert' | 'delete';
  label: string;
  queuedAt: string;
}
