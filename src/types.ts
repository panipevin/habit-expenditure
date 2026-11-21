export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type BoardStatus = 'backlog' | 'in_progress' | 'review' | 'done';
export type ExpenseCategory =
  | 'Food'
  | 'Transport'
  | 'Housing'
  | 'Software'
  | 'Health'
  | 'Utilities'
  | 'Leisure';

export type AppSection =
  | 'dashboard'
  | 'tasks'
  | 'habits'
  | 'boards'
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

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatarUrl: string;
  initials: string;
  status: 'active' | 'focus' | 'offline';
}

export interface BoardItem {
  id: string;
  boardId: string;
  creatorId: string;
  title: string;
  status: BoardStatus;
  priority: TaskPriority;
  assigneeName: string;
  assigneeAvatar?: string;
  dueDate: string;
  updatedAt: string;
}

export interface BoardComment {
  id: string;
  boardId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  body: string;
  createdAt: string;
}

export interface SharedBoard {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  memberIds: string[];
  members: TeamMember[];
  items: BoardItem[];
  comments: BoardComment[];
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
  boardName?: string;
}

export type WidgetId =
  | 'tasks'
  | 'habits'
  | 'calendar'
  | 'boards'
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
  category: 'deadline' | 'streak' | 'team' | 'budget' | 'sync';
  timestamp: string;
  read: boolean;
}

export interface SyncQueueItem {
  id: string;
  entity: 'task' | 'habit' | 'expense' | 'boardItem' | 'boardComment' | 'calendarEvent';
  action: 'upsert' | 'delete';
  label: string;
  queuedAt: string;
}
