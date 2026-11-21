import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import { dispatchBrowserNotification } from '../lib/notifications';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  createSeedData,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_WIDGETS,
  TEAM_MEMBERS,
} from '../data/seed';
import { DEFAULT_BUDGET_LIMITS } from '../utils/finance';
import {
  applyGracePeriod,
  claimHabitMilestone,
  evaluateHabitStreak,
  setHabitPauseState,
  toggleHabitCompletionForDate,
} from '../utils/streaks';
import { getTodayISO, isBeforeEveningCutoff } from '../utils/dates';
import type {
  AppSection,
  BoardComment,
  BoardItem,
  BoardStatus,
  BudgetLimits,
  CalendarEvent,
  CalendarEventType,
  DailyTask,
  Expense,
  ExpenseCategory,
  Habit,
  InAppNotification,
  NotificationPreferences,
  SharedBoard,
  SyncQueueItem,
  TaskPriority,
  TaskStatus,
  WidgetConfig,
  WidgetId,
} from '../types';

const STORAGE_KEY = 'cadence_workspace_state_v1';

interface PersistedWorkspace {
  tasks: DailyTask[];
  habits: Habit[];
  expenses: Expense[];
  budgetLimits: BudgetLimits;
  boards: SharedBoard[];
  calendarEvents: CalendarEvent[];
  widgets: WidgetConfig[];
  notificationPrefs: NotificationPreferences;
  notifications: InAppNotification[];
  syncQueue: SyncQueueItem[];
  theme: 'light' | 'dark';
  vaultLockEnabled: boolean;
  lastSyncedAt: string;
}

function loadInitialWorkspace(todayISO: string): PersistedWorkspace {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedWorkspace>;
      const seed = createSeedData(todayISO);
      return {
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : seed.tasks,
        habits: Array.isArray(parsed.habits) ? parsed.habits : seed.habits,
        expenses: Array.isArray(parsed.expenses) ? parsed.expenses : seed.expenses,
        budgetLimits: parsed.budgetLimits ? { ...DEFAULT_BUDGET_LIMITS, ...parsed.budgetLimits } : DEFAULT_BUDGET_LIMITS,
        boards: Array.isArray(parsed.boards) && parsed.boards.length > 0 ? parsed.boards : seed.boards,
        calendarEvents: Array.isArray(parsed.calendarEvents) ? parsed.calendarEvents : seed.calendarEvents,
        widgets: Array.isArray(parsed.widgets) && parsed.widgets.length > 0 ? parsed.widgets : DEFAULT_WIDGETS,
        notificationPrefs: parsed.notificationPrefs
          ? { ...DEFAULT_NOTIFICATION_PREFS, ...parsed.notificationPrefs }
          : DEFAULT_NOTIFICATION_PREFS,
        notifications: Array.isArray(parsed.notifications) ? parsed.notifications : seed.notifications,
        syncQueue: Array.isArray(parsed.syncQueue) ? parsed.syncQueue : [],
        theme: parsed.theme === 'dark' ? 'dark' : 'light',
        vaultLockEnabled: Boolean(parsed.vaultLockEnabled),
        lastSyncedAt: parsed.lastSyncedAt || new Date().toISOString(),
      };
    }
  } catch {
    // Fall back to fresh seed data
  }

  const seed = createSeedData(todayISO);
  return {
    tasks: seed.tasks,
    habits: seed.habits,
    expenses: seed.expenses,
    budgetLimits: DEFAULT_BUDGET_LIMITS,
    boards: seed.boards,
    calendarEvents: seed.calendarEvents,
    widgets: DEFAULT_WIDGETS,
    notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
    notifications: seed.notifications,
    syncQueue: [],
    theme: 'light',
    vaultLockEnabled: false,
    lastSyncedAt: new Date().toISOString(),
  };
}

interface WorkspaceContextValue {
  todayISO: string;
  activeSection: AppSection;
  setActiveSection: (s: AppSection) => void;
  globalSearch: string;
  setGlobalSearch: (q: string) => void;

  // Auth & Cloud Sync
  user: User | null;
  authReady: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  isOnline: boolean;
  simulatedOffline: boolean;
  setSimulatedOffline: (offline: boolean) => void;
  effectiveOnline: boolean;
  syncQueue: SyncQueueItem[];
  lastSyncedAt: string;
  flushSyncQueue: () => void;

  // Theme
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // Biometric / Privacy Vault
  vaultLockEnabled: boolean;
  setVaultLockEnabled: (enabled: boolean) => void;
  isVaultLocked: boolean;
  lockVault: () => void;
  unlockVault: () => void;

  // Tasks
  tasks: DailyTask[];
  addTask: (input: {
    title: string;
    notes?: string;
    category: string;
    priority: TaskPriority;
    dueDate: string;
    dueTime?: string;
    reminderEnabled: boolean;
  }) => void;
  toggleTaskStatus: (id: string) => void;
  updateTaskStatus: (id: string, status: TaskStatus) => void;
  deleteTask: (id: string) => void;

  // Habits
  habits: Habit[];
  addHabit: (input: { name: string; category: string; reminderTime: string }) => void;
  toggleHabitToday: (id: string) => void;
  useHabitGracePeriod: (id: string) => { ok: boolean; message: string };
  toggleHabitPause: (id: string, paused: boolean, reason?: string) => void;
  claimMilestoneReward: (habitId: string, milestoneDays: number) => void;
  deleteHabit: (id: string) => void;

  // Expenses & Budgets
  expenses: Expense[];
  budgetLimits: BudgetLimits;
  addExpense: (input: {
    title: string;
    category: ExpenseCategory;
    amount: number;
    date: string;
    note?: string;
  }) => void;
  deleteExpense: (id: string) => void;
  updateBudgetLimit: (category: ExpenseCategory, amount: number) => void;

  // Shared Boards
  boards: SharedBoard[];
  addBoard: (name: string, description: string) => void;
  addBoardItem: (
    boardId: string,
    input: { title: string; priority: TaskPriority; assigneeName: string; dueDate: string }
  ) => void;
  moveBoardItemStatus: (boardId: string, itemId: string, status: BoardStatus) => void;
  addBoardComment: (boardId: string, body: string) => void;

  // Calendar
  calendarEvents: CalendarEvent[];
  addCalendarEvent: (input: {
    title: string;
    eventType: CalendarEventType;
    date: string;
    startTime: string;
    endTime?: string;
    urgent: boolean;
    reminderMinutes: number;
    participants: string[];
  }) => void;
  deleteCalendarEvent: (id: string) => void;

  // Widgets & Notifications
  widgets: WidgetConfig[];
  toggleWidgetVisibility: (id: WidgetId) => void;
  moveWidget: (id: WidgetId, direction: 'up' | 'down') => void;
  toggleWidgetSize: (id: WidgetId) => void;
  notificationPrefs: NotificationPreferences;
  updateNotificationPrefs: (patch: Partial<NotificationPreferences>) => void;
  notifications: InAppNotification[];
  markAllNotificationsRead: () => void;
  pushAlert: (title: string, message: string, category: InAppNotification['category']) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const todayISO = useMemo(() => getTodayISO(), []);
  const initial = useMemo(() => loadInitialWorkspace(todayISO), [todayISO]);

  const [activeSection, setActiveSection] = useState<AppSection>('dashboard');
  const [globalSearch, setGlobalSearch] = useState('');

  const [tasks, setTasks] = useState<DailyTask[]>(initial.tasks);
  const [habits, setHabits] = useState<Habit[]>(initial.habits);
  const [expenses, setExpenses] = useState<Expense[]>(initial.expenses);
  const [budgetLimits, setBudgetLimits] = useState<BudgetLimits>(initial.budgetLimits);
  const [boards, setBoards] = useState<SharedBoard[]>(initial.boards);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(initial.calendarEvents);
  const [widgets, setWidgets] = useState<WidgetConfig[]>(initial.widgets);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(
    initial.notificationPrefs
  );
  const [notifications, setNotifications] = useState<InAppNotification[]>(initial.notifications);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>(initial.syncQueue);
  const [theme, setTheme] = useState<'light' | 'dark'>(initial.theme);
  const [vaultLockEnabled, setVaultLockEnabledState] = useState<boolean>(initial.vaultLockEnabled);
  const [isVaultLocked, setIsVaultLocked] = useState<boolean>(initial.vaultLockEnabled);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(initial.lastSyncedAt);

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const browserOnline = useOnlineStatus();
  const [simulatedOffline, setSimulatedOffline] = useState(false);
  const effectiveOnline = browserOnline && !simulatedOffline;
  const prevOnlineRef = useRef(effectiveOnline);
  const pendingCloudActionsRef = useRef<(() => Promise<void>)[]>([]);

  // Sync HTML class for Tailwind v4 dark mode
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Persist workspace locally for seamless offline-first continuity
  useEffect(() => {
    const payload: PersistedWorkspace = {
      tasks,
      habits,
      expenses,
      budgetLimits,
      boards,
      calendarEvents,
      widgets,
      notificationPrefs,
      notifications,
      syncQueue,
      theme,
      vaultLockEnabled,
      lastSyncedAt,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota issues
    }
  }, [
    tasks,
    habits,
    expenses,
    budgetLimits,
    boards,
    calendarEvents,
    widgets,
    notificationPrefs,
    notifications,
    syncQueue,
    theme,
    vaultLockEnabled,
    lastSyncedAt,
  ]);

  const pushAlert = useCallback(
    (title: string, message: string, category: InAppNotification['category']) => {
      const entry: InAppNotification = {
        id: makeId('notif'),
        title,
        message,
        category,
        timestamp: new Date().toISOString(),
        read: false,
      };
      setNotifications((prev) => [entry, ...prev].slice(0, 30));
      if (notificationPrefs.pushEnabled) {
        dispatchBrowserNotification(title, message);
      }
    },
    [notificationPrefs.pushEnabled]
  );

  // Firebase Authentication listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Real-time Firestore listeners for ALL collections when authenticated with Google
  useEffect(() => {
    if (!authReady || !user) return;

    const uid = user.uid;
    const unsubs: (() => void)[] = [];
    const boardSubUnsubs = new Map<string, () => void>();

    // Ensure profile document exists using strict create vs update (preserving immutable createdAt)
    const profileRef = doc(db, 'users', uid);
    void getDoc(profileRef)
      .then(async (snap) => {
        if (!snap.exists()) {
          await setDoc(profileRef, {
            uid,
            displayName: (user.displayName || 'Workspace User').slice(0, 80),
            ...(user.email ? { email: user.email.slice(0, 160) } : {}),
            eveningCutoffHour: notificationPrefs.eveningCutoffHour,
            biometricEnabled: vaultLockEnabled,
            theme,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(profileRef, {
            displayName: (user.displayName || 'Workspace User').slice(0, 80),
            ...(user.email ? { email: user.email.slice(0, 160) } : {}),
            eveningCutoffHour: notificationPrefs.eveningCutoffHour,
            biometricEnabled: vaultLockEnabled,
            theme,
            updatedAt: serverTimestamp(),
          });
        }
      })
      .catch((err) => {
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
      });

    // 1. Personal Tasks listener
    const tasksPath = `users/${uid}/tasks`;
    unsubs.push(
      onSnapshot(
        query(collection(db, tasksPath), where('ownerId', '==', uid)),
        (snap) => {
          if (!snap.empty) {
            const remoteTasks: DailyTask[] = snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                ownerId: String(data.ownerId || uid),
                title: String(data.title || ''),
                notes: data.notes ? String(data.notes) : undefined,
                category: String(data.category || 'General'),
                priority: (data.priority || 'medium') as TaskPriority,
                status: (data.status || 'todo') as TaskStatus,
                dueDate: String(data.dueDate || todayISO),
                dueTime: data.dueTime ? String(data.dueTime) : undefined,
                assignedBeforeNight: Boolean(data.assignedBeforeNight),
                reminderEnabled: Boolean(data.reminderEnabled),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
            });
            setTasks(remoteTasks);
            setLastSyncedAt(new Date().toISOString());
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, tasksPath)
      )
    );

    // 2. Personal Habits listener
    const habitsPath = `users/${uid}/habits`;
    unsubs.push(
      onSnapshot(
        query(collection(db, habitsPath), where('ownerId', '==', uid)),
        (snap) => {
          if (!snap.empty) {
            const remoteHabits: Habit[] = snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                ownerId: String(data.ownerId || uid),
                name: String(data.name || ''),
                category: String(data.category || 'Focus'),
                reminderTime: String(data.reminderTime || '08:00'),
                completedDates: Array.isArray(data.completedDates) ? data.completedDates : [],
                graceDates: Array.isArray(data.graceDates) ? data.graceDates : [],
                graceTokensRemaining: typeof data.graceTokensRemaining === 'number' ? data.graceTokensRemaining : 2,
                isPaused: Boolean(data.isPaused),
                pauseReason: data.pauseReason ? String(data.pauseReason) : undefined,
                pausedSince: data.pausedSince ? String(data.pausedSince) : undefined,
                claimedMilestones: Array.isArray(data.claimedMilestones) ? data.claimedMilestones : [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
            });
            setHabits(remoteHabits);
            setLastSyncedAt(new Date().toISOString());
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, habitsPath)
      )
    );

    // 3. Personal Expenses listener
    const expensesPath = `users/${uid}/expenses`;
    unsubs.push(
      onSnapshot(
        query(collection(db, expensesPath), where('ownerId', '==', uid)),
        (snap) => {
          if (!snap.empty) {
            const remoteExpenses: Expense[] = snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                ownerId: String(data.ownerId || uid),
                title: String(data.title || ''),
                category: (data.category || 'Food') as ExpenseCategory,
                amount: Number(data.amount || 0),
                date: String(data.date || todayISO),
                note: data.note ? String(data.note) : undefined,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
            });
            setExpenses(remoteExpenses);
            setLastSyncedAt(new Date().toISOString());
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, expensesPath)
      )
    );

    // 4. Shared Team Boards + subcollections listener
    const boardsPath = 'boards';
    unsubs.push(
      onSnapshot(
        query(collection(db, boardsPath), where('memberIds', 'array-contains', uid)),
        (snap) => {
          if (snap.empty) return;
          const activeIds = new Set<string>();
          snap.docs.forEach((bDoc) => {
            const bData = bDoc.data();
            const bId = bDoc.id;
            activeIds.add(bId);
            const memberIds: string[] = Array.isArray(bData.memberIds) ? bData.memberIds : [uid];

            setBoards((prev) => {
              const existingBoard = prev.find((b) => b.id === bId);
              const nextBoard: SharedBoard = {
                id: bId,
                name: String(bData.name || 'Shared Board'),
                description: String(bData.description || ''),
                ownerId: String(bData.ownerId || uid),
                memberIds,
                members: existingBoard?.members || TEAM_MEMBERS,
                items: existingBoard?.items || [],
                comments: existingBoard?.comments || [],
                updatedAt: new Date().toISOString(),
              };
              const others = prev.filter((b) => b.id !== bId && b.ownerId !== 'local-user');
              return [nextBoard, ...others];
            });

            if (!boardSubUnsubs.has(bId)) {
              const itemsPath = `boards/${bId}/items`;
              const unsubItems = onSnapshot(
                query(collection(db, itemsPath), where('boardId', '==', bId), where('memberIds', 'array-contains', uid)),
                (itemSnap) => {
                  const items: BoardItem[] = itemSnap.docs.map((docSnap) => {
                    const d = docSnap.data();
                    return {
                      id: docSnap.id,
                      boardId: bId,
                      creatorId: String(d.creatorId || uid),
                      title: String(d.title || ''),
                      status: (d.status || 'backlog') as BoardStatus,
                      priority: (d.priority || 'medium') as TaskPriority,
                      assigneeName: String(d.assigneeName || 'You'),
                      dueDate: String(d.dueDate || todayISO),
                      updatedAt: new Date().toISOString(),
                    };
                  });
                  setBoards((prev) => prev.map((b) => (b.id === bId ? { ...b, items } : b)));
                },
                (err) => handleFirestoreError(err, OperationType.LIST, itemsPath)
              );

              const commentsPath = `boards/${bId}/comments`;
              const unsubComments = onSnapshot(
                query(collection(db, commentsPath), where('boardId', '==', bId), where('memberIds', 'array-contains', uid)),
                (commSnap) => {
                  const comments: BoardComment[] = commSnap.docs.map((docSnap) => {
                    const d = docSnap.data();
                    return {
                      id: docSnap.id,
                      boardId: bId,
                      authorId: String(d.authorId || uid),
                      authorName: String(d.authorName || 'Member'),
                      body: String(d.body || ''),
                      createdAt: new Date().toISOString(),
                    };
                  });
                  setBoards((prev) => prev.map((b) => (b.id === bId ? { ...b, comments } : b)));
                },
                (err) => handleFirestoreError(err, OperationType.LIST, commentsPath)
              );

              boardSubUnsubs.set(bId, () => {
                unsubItems();
                unsubComments();
              });
            }
          });

          boardSubUnsubs.forEach((cleanup, bId) => {
            if (!activeIds.has(bId)) {
              cleanup();
              boardSubUnsubs.delete(bId);
            }
          });
        },
        (err) => handleFirestoreError(err, OperationType.LIST, boardsPath)
      )
    );

    // 5. Integrated Calendar Events listener
    const calPath = 'calendarEvents';
    unsubs.push(
      onSnapshot(
        query(collection(db, calPath), where('participantIds', 'array-contains', uid)),
        (snap) => {
          if (!snap.empty) {
            const remoteEvents: CalendarEvent[] = snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                ownerId: String(data.ownerId || uid),
                title: String(data.title || ''),
                eventType: (data.eventType || 'meeting') as CalendarEventType,
                date: String(data.date || todayISO),
                startTime: String(data.startTime || '09:00'),
                endTime: data.endTime ? String(data.endTime) : undefined,
                urgent: Boolean(data.urgent),
                reminderMinutes: Number(data.reminderMinutes ?? 15),
                participants: ['You'],
              };
            });
            setCalendarEvents(remoteEvents);
            setLastSyncedAt(new Date().toISOString());
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, calPath)
      )
    );

    return () => {
      unsubs.forEach((fn) => fn());
      boardSubUnsubs.forEach((fn) => fn());
    };
  }, [authReady, user, todayISO, notificationPrefs.eveningCutoffHour, theme, vaultLockEnabled]);

  const queueOrSync = useCallback(
    (item: Omit<SyncQueueItem, 'id' | 'queuedAt'>, cloudAction?: () => Promise<void>) => {
      if (!effectiveOnline) {
        if (cloudAction) {
          pendingCloudActionsRef.current.push(cloudAction);
        }
        setSyncQueue((prev) => [
          { ...item, id: makeId('sync'), queuedAt: new Date().toISOString() },
          ...prev,
        ]);
        return;
      }
      if (user && cloudAction) {
        void cloudAction()
          .then(() => setLastSyncedAt(new Date().toISOString()))
          .catch(() => {
            pendingCloudActionsRef.current.push(cloudAction);
            setSyncQueue((prev) => [
              { ...item, id: makeId('sync'), queuedAt: new Date().toISOString() },
              ...prev,
            ]);
          });
      } else {
        setLastSyncedAt(new Date().toISOString());
      }
    },
    [effectiveOnline, user]
  );

  const flushSyncQueue = useCallback(() => {
    if (!effectiveOnline || syncQueue.length === 0) return;
    const count = syncQueue.length;
    const actionsToRun = [...pendingCloudActionsRef.current];
    pendingCloudActionsRef.current = [];
    if (user && actionsToRun.length > 0) {
      void Promise.allSettled(actionsToRun.map((fn) => fn()));
    }
    setSyncQueue([]);
    setLastSyncedAt(new Date().toISOString());
    pushAlert(
      'Offline Changes Synced',
      `${count} queued update${count === 1 ? '' : 's'} synchronized cleanly across devices.`,
      'sync'
    );
  }, [effectiveOnline, syncQueue.length, user, pushAlert]);

  // Automatically flush queued offline writes when connectivity is restored
  useEffect(() => {
    if (!prevOnlineRef.current && effectiveOnline && syncQueue.length > 0) {
      flushSyncQueue();
    }
    prevOnlineRef.current = effectiveOnline;
  }, [effectiveOnline, syncQueue.length, flushSyncQueue]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      pushAlert('Cloud Sync Connected', 'Your workspace is now syncing via Firebase Cloud.', 'sync');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google sign-in failed.');
    }
  }, [pushAlert]);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const setVaultLockEnabled = useCallback((enabled: boolean) => {
    setVaultLockEnabledState(enabled);
    if (!enabled) setIsVaultLocked(false);
  }, []);

  const lockVault = useCallback(() => {
    setIsVaultLocked(true);
  }, []);

  const unlockVault = useCallback(() => {
    setIsVaultLocked(false);
  }, []);

  // --- Task Actions ---
  const addTask = useCallback(
    (input: {
      title: string;
      notes?: string;
      category: string;
      priority: TaskPriority;
      dueDate: string;
      dueTime?: string;
      reminderEnabled: boolean;
    }) => {
      const now = new Date();
      const id = makeId('task');
      const ownerId = user?.uid || 'local-user';
      const assignedBeforeNight = isBeforeEveningCutoff(now, notificationPrefs.eveningCutoffHour);

      const newTask: DailyTask = {
        id,
        ownerId,
        title: input.title.trim().slice(0, 160),
        notes: input.notes?.trim().slice(0, 500) || undefined,
        category: input.category.trim().slice(0, 40) || 'General',
        priority: input.priority,
        status: 'todo',
        dueDate: input.dueDate,
        dueTime: input.dueTime || undefined,
        assignedBeforeNight,
        reminderEnabled: input.reminderEnabled,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      setTasks((prev) => [newTask, ...prev]);

      if (input.priority === 'urgent' && notificationPrefs.urgentDeadlines) {
        pushAlert(
          'Urgent Task Scheduled',
          `"${newTask.title}" scheduled for ${newTask.dueDate}${newTask.dueTime ? ` at ${newTask.dueTime}` : ''}.`,
          'deadline'
        );
      }

      queueOrSync(
        { entity: 'task', action: 'upsert', label: newTask.title },
        user
          ? async () => {
              const path = `users/${user.uid}/tasks/${id}`;
              try {
                await setDoc(doc(db, 'users', user.uid, 'tasks', id), {
                  ownerId: user.uid,
                  title: newTask.title,
                  ...(newTask.notes ? { notes: newTask.notes } : {}),
                  category: newTask.category,
                  priority: newTask.priority,
                  status: newTask.status,
                  dueDate: newTask.dueDate,
                  ...(newTask.dueTime ? { dueTime: newTask.dueTime } : {}),
                  assignedBeforeNight: newTask.assignedBeforeNight,
                  reminderEnabled: newTask.reminderEnabled,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              } catch (err) {
                handleFirestoreError(err, OperationType.CREATE, path);
              }
            }
          : undefined
      );
    },
    [user, notificationPrefs.eveningCutoffHour, notificationPrefs.urgentDeadlines, pushAlert, queueOrSync]
  );

  const updateTaskStatus = useCallback(
    (id: string, status: TaskStatus) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t))
      );
      queueOrSync(
        { entity: 'task', action: 'upsert', label: `Task ${status}` },
        user
          ? async () => {
              const path = `users/${user.uid}/tasks/${id}`;
              try {
                await updateDoc(doc(db, 'users', user.uid, 'tasks', id), {
                  status,
                  updatedAt: serverTimestamp(),
                });
              } catch (err) {
                handleFirestoreError(err, OperationType.UPDATE, path);
              }
            }
          : undefined
      );
    },
    [user, queueOrSync]
  );

  const toggleTaskStatus = useCallback(
    (id: string) => {
      const current = tasks.find((t) => t.id === id);
      const nextStatus: TaskStatus = current?.status === 'done' ? 'todo' : 'done';
      updateTaskStatus(id, nextStatus);
    },
    [tasks, updateTaskStatus]
  );

  const deleteTask = useCallback(
    (id: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      queueOrSync(
        { entity: 'task', action: 'delete', label: 'Remove task' },
        user
          ? async () => {
              const path = `users/${user.uid}/tasks/${id}`;
              try {
                await deleteDoc(doc(db, 'users', user.uid, 'tasks', id));
              } catch (err) {
                handleFirestoreError(err, OperationType.DELETE, path);
              }
            }
          : undefined
      );
    },
    [user, queueOrSync]
  );

  // --- Gamified Habit Actions ---
  const addHabit = useCallback(
    (input: { name: string; category: string; reminderTime: string }) => {
      const id = makeId('habit');
      const nowISO = new Date().toISOString();
      const newHabit: Habit = {
        id,
        ownerId: user?.uid || 'local-user',
        name: input.name.trim().slice(0, 80),
        category: input.category.trim().slice(0, 40) || 'Focus',
        reminderTime: input.reminderTime || '08:00',
        completedDates: [],
        graceDates: [],
        graceTokensRemaining: 2,
        isPaused: false,
        claimedMilestones: [],
        createdAt: nowISO,
        updatedAt: nowISO,
      };
      setHabits((prev) => [newHabit, ...prev]);
      queueOrSync(
        { entity: 'habit', action: 'upsert', label: newHabit.name },
        user
          ? async () => {
              const path = `users/${user.uid}/habits/${id}`;
              try {
                await setDoc(doc(db, 'users', user.uid, 'habits', id), {
                  ownerId: user.uid,
                  name: newHabit.name,
                  category: newHabit.category,
                  reminderTime: newHabit.reminderTime,
                  completedDates: [],
                  graceDates: [],
                  graceTokensRemaining: 2,
                  isPaused: false,
                  claimedMilestones: [],
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              } catch (err) {
                handleFirestoreError(err, OperationType.CREATE, path);
              }
            }
          : undefined
      );
    },
    [user, queueOrSync]
  );

  const toggleHabitToday = useCallback(
    (id: string) => {
      const target = habits.find((h) => h.id === id);
      if (!target) return;
      const updated = toggleHabitCompletionForDate(target, todayISO);
      const beforeSummary = evaluateHabitStreak(target, todayISO);
      const afterSummary = evaluateHabitStreak(updated, todayISO);
      if (afterSummary.unclaimedMilestones.length > beforeSummary.unclaimedMilestones.length) {
        const newest =
          afterSummary.unclaimedMilestones[afterSummary.unclaimedMilestones.length - 1];
        pushAlert(
          `${newest.days}-Day Streak Milestone Unlocked`,
          `"${target.name}" earned ${newest.title} (+${newest.rewardXP} XP bonus ready to claim).`,
          'streak'
        );
      }

      setHabits((prev) => prev.map((h) => (h.id === id ? updated : h)));
      queueOrSync(
        { entity: 'habit', action: 'upsert', label: 'Habit check-in' },
        user
          ? async () => {
              const path = `users/${user.uid}/habits/${id}`;
              try {
                await updateDoc(doc(db, 'users', user.uid, 'habits', id), {
                  completedDates: updated.completedDates,
                  claimedMilestones: updated.claimedMilestones,
                  updatedAt: serverTimestamp(),
                });
              } catch (err) {
                handleFirestoreError(err, OperationType.UPDATE, path);
              }
            }
          : undefined
      );
    },
    [habits, todayISO, pushAlert, user, queueOrSync]
  );

  const useHabitGracePeriod = useCallback(
    (id: string): { ok: boolean; message: string } => {
      const target = habits.find((h) => h.id === id);
      if (!target) return { ok: false, message: 'Habit not found.' };
      const res = applyGracePeriod(target, todayISO);
      if (!res.appliedDate) {
        return { ok: false, message: res.reason || 'Grace shield unavailable.' };
      }

      setHabits((prev) => prev.map((h) => (h.id === id ? res.habit : h)));
      queueOrSync(
        { entity: 'habit', action: 'upsert', label: 'Applied grace shield' },
        user
          ? async () => {
              const path = `users/${user.uid}/habits/${id}`;
              try {
                await updateDoc(doc(db, 'users', user.uid, 'habits', id), {
                  graceDates: res.habit.graceDates,
                  graceTokensRemaining: res.habit.graceTokensRemaining,
                  updatedAt: serverTimestamp(),
                });
              } catch (err) {
                handleFirestoreError(err, OperationType.UPDATE, path);
              }
            }
          : undefined
      );
      return {
        ok: true,
        message: `Grace shield applied for ${res.appliedDate}. Your streak is protected.`,
      };
    },
    [habits, todayISO, user, queueOrSync]
  );

  const toggleHabitPause = useCallback(
    (id: string, paused: boolean, reason?: string) => {
      const target = habits.find((h) => h.id === id);
      if (!target) return;
      const updated = setHabitPauseState(target, paused, todayISO, reason);
      setHabits((prev) => prev.map((h) => (h.id === id ? updated : h)));
      queueOrSync(
        {
          entity: 'habit',
          action: 'upsert',
          label: paused ? 'Paused habit streak' : 'Resumed habit streak',
        },
        user
          ? async () => {
              const path = `users/${user.uid}/habits/${id}`;
              try {
                await updateDoc(doc(db, 'users', user.uid, 'habits', id), {
                  isPaused: updated.isPaused,
                  pauseReason: updated.pauseReason ? updated.pauseReason : deleteField(),
                  pausedSince: updated.pausedSince ? updated.pausedSince : deleteField(),
                  graceDates: updated.graceDates,
                  updatedAt: serverTimestamp(),
                });
              } catch (err) {
                handleFirestoreError(err, OperationType.UPDATE, path);
              }
            }
          : undefined
      );
    },
    [habits, todayISO, user, queueOrSync]
  );

  const claimMilestoneReward = useCallback(
    (habitId: string, milestoneDays: number) => {
      const target = habits.find((h) => h.id === habitId);
      if (!target) return;
      const updated = claimHabitMilestone(target, milestoneDays);
      setHabits((prev) => prev.map((h) => (h.id === habitId ? updated : h)));
      queueOrSync(
        {
          entity: 'habit',
          action: 'upsert',
          label: `Claimed ${milestoneDays}-day streak reward`,
        },
        user
          ? async () => {
              const path = `users/${user.uid}/habits/${habitId}`;
              try {
                await updateDoc(doc(db, 'users', user.uid, 'habits', habitId), {
                  completedDates: updated.completedDates,
                  claimedMilestones: updated.claimedMilestones,
                  updatedAt: serverTimestamp(),
                });
              } catch (err) {
                handleFirestoreError(err, OperationType.UPDATE, path);
              }
            }
          : undefined
      );
    },
    [habits, user, queueOrSync]
  );

  const deleteHabit = useCallback(
    (id: string) => {
      setHabits((prev) => prev.filter((h) => h.id !== id));
      queueOrSync(
        { entity: 'habit', action: 'delete', label: 'Deleted habit' },
        user
          ? async () => {
              const path = `users/${user.uid}/habits/${id}`;
              try {
                await deleteDoc(doc(db, 'users', user.uid, 'habits', id));
              } catch (err) {
                handleFirestoreError(err, OperationType.DELETE, path);
              }
            }
          : undefined
      );
    },
    [user, queueOrSync]
  );

  // --- Expense & Budget Actions ---
  const addExpense = useCallback(
    (input: {
      title: string;
      category: ExpenseCategory;
      amount: number;
      date: string;
      note?: string;
    }) => {
      const id = makeId('exp');
      const nowISO = new Date().toISOString();
      const entry: Expense = {
        id,
        ownerId: user?.uid || 'local-user',
        title: input.title.trim().slice(0, 120),
        category: input.category,
        amount: Math.round(input.amount * 100) / 100,
        date: input.date,
        note: input.note?.trim().slice(0, 240) || undefined,
        createdAt: nowISO,
        updatedAt: nowISO,
      };
      setExpenses((prev) => [entry, ...prev]);

      if (notificationPrefs.budgetThresholdAlerts) {
        const monthPrefix = input.date.slice(0, 7);
        const currentCategoryTotal =
          expenses
            .filter((e) => e.category === input.category && e.date.startsWith(monthPrefix))
            .reduce((sum, e) => sum + e.amount, 0) + entry.amount;
        const limit = budgetLimits[input.category];
        if (limit > 0 && currentCategoryTotal > limit) {
          pushAlert(
            `${input.category} Budget Exceeded`,
            `Monthly ${input.category} spend reached $${currentCategoryTotal.toFixed(2)} (limit $${limit.toFixed(2)}).`,
            'budget'
          );
        }
      }

      queueOrSync(
        { entity: 'expense', action: 'upsert', label: entry.title },
        user
          ? async () => {
              const path = `users/${user.uid}/expenses/${id}`;
              try {
                await setDoc(doc(db, 'users', user.uid, 'expenses', id), {
                  ownerId: user.uid,
                  title: entry.title,
                  category: entry.category,
                  amount: entry.amount,
                  date: entry.date,
                  ...(entry.note ? { note: entry.note } : {}),
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              } catch (err) {
                handleFirestoreError(err, OperationType.CREATE, path);
              }
            }
          : undefined
      );
    },
    [user, expenses, budgetLimits, notificationPrefs.budgetThresholdAlerts, pushAlert, queueOrSync]
  );

  const deleteExpense = useCallback(
    (id: string) => {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      queueOrSync(
        { entity: 'expense', action: 'delete', label: 'Deleted expense' },
        user
          ? async () => {
              const path = `users/${user.uid}/expenses/${id}`;
              try {
                await deleteDoc(doc(db, 'users', user.uid, 'expenses', id));
              } catch (err) {
                handleFirestoreError(err, OperationType.DELETE, path);
              }
            }
          : undefined
      );
    },
    [user, queueOrSync]
  );

  const updateBudgetLimit = useCallback((category: ExpenseCategory, amount: number) => {
    setBudgetLimits((prev) => ({
      ...prev,
      [category]: Math.max(0, Math.round(amount)),
    }));
  }, []);

  // --- Shared Board Actions ---
  const addBoard = useCallback(
    (name: string, description: string) => {
      const id = makeId('board');
      const nowISO = new Date().toISOString();
      const ownerId = user?.uid || 'local-user';
      const newBoard: SharedBoard = {
        id,
        name: name.trim().slice(0, 80),
        description: description.trim().slice(0, 240),
        ownerId,
        memberIds: [ownerId],
        members: boards[0]?.members || TEAM_MEMBERS,
        items: [],
        comments: [],
        updatedAt: nowISO,
      };
      setBoards((prev) => [...prev, newBoard]);
      queueOrSync(
        { entity: 'boardItem', action: 'upsert', label: `Created board ${newBoard.name}` },
        user
          ? async () => {
              const path = `boards/${id}`;
              try {
                await setDoc(doc(db, 'boards', id), {
                  name: newBoard.name,
                  ...(newBoard.description ? { description: newBoard.description } : {}),
                  ownerId: user.uid,
                  memberIds: [user.uid],
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              } catch (err) {
                handleFirestoreError(err, OperationType.CREATE, path);
              }
            }
          : undefined
      );
    },
    [user, boards, queueOrSync]
  );

  const addBoardItem = useCallback(
    (
      boardId: string,
      input: { title: string; priority: TaskPriority; assigneeName: string; dueDate: string }
    ) => {
      const id = makeId('bi');
      const nowISO = new Date().toISOString();
      const board = boards.find((b) => b.id === boardId);
      const memberIds = board?.memberIds || (user ? [user.uid] : ['local-user']);

      setBoards((prev) =>
        prev.map((b) => {
          if (b.id !== boardId) return b;
          const member = b.members.find((m) => m.name === input.assigneeName);
          const item: BoardItem = {
            id,
            boardId,
            creatorId: user?.uid || 'local-user',
            title: input.title.trim().slice(0, 160),
            status: 'backlog',
            priority: input.priority,
            assigneeName: input.assigneeName.slice(0, 60),
            assigneeAvatar: member?.avatarUrl,
            dueDate: input.dueDate,
            updatedAt: nowISO,
          };
          return {
            ...b,
            items: [item, ...b.items],
            updatedAt: nowISO,
          };
        })
      );

      queueOrSync(
        { entity: 'boardItem', action: 'upsert', label: input.title },
        user && board && board.ownerId !== 'local-user'
          ? async () => {
              const path = `boards/${boardId}/items/${id}`;
              try {
                await setDoc(doc(db, 'boards', boardId, 'items', id), {
                  boardId,
                  creatorId: user.uid,
                  memberIds,
                  title: input.title.trim().slice(0, 160),
                  status: 'backlog',
                  priority: input.priority,
                  assigneeName: input.assigneeName.slice(0, 60),
                  dueDate: input.dueDate,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              } catch (err) {
                handleFirestoreError(err, OperationType.CREATE, path);
              }
            }
          : undefined
      );
    },
    [boards, user, queueOrSync]
  );

  const moveBoardItemStatus = useCallback(
    (boardId: string, itemId: string, status: BoardStatus) => {
      const nowISO = new Date().toISOString();
      const board = boards.find((b) => b.id === boardId);
      setBoards((prev) =>
        prev.map((b) => {
          if (b.id !== boardId) return b;
          return {
            ...b,
            items: b.items.map((item) =>
              item.id === itemId ? { ...item, status, updatedAt: nowISO } : item
            ),
            updatedAt: nowISO,
          };
        })
      );
      queueOrSync(
        { entity: 'boardItem', action: 'upsert', label: `Moved card to ${status}` },
        user && board && board.ownerId !== 'local-user'
          ? async () => {
              const path = `boards/${boardId}/items/${itemId}`;
              try {
                await updateDoc(doc(db, 'boards', boardId, 'items', itemId), {
                  status,
                  updatedAt: serverTimestamp(),
                });
              } catch (err) {
                handleFirestoreError(err, OperationType.UPDATE, path);
              }
            }
          : undefined
      );
    },
    [boards, user, queueOrSync]
  );

  const addBoardComment = useCallback(
    (boardId: string, body: string) => {
      const trimmed = body.trim().slice(0, 400);
      if (!trimmed) return;
      const id = makeId('bc');
      const nowISO = new Date().toISOString();
      const authorName = (user?.displayName || 'You').slice(0, 60);
      const board = boards.find((b) => b.id === boardId);
      const memberIds = board?.memberIds || (user ? [user.uid] : ['local-user']);

      const comment: BoardComment = {
        id,
        boardId,
        authorId: user?.uid || 'local-user',
        authorName,
        body: trimmed,
        createdAt: nowISO,
      };
      setBoards((prev) =>
        prev.map((b) =>
          b.id === boardId ? { ...b, comments: [...b.comments, comment], updatedAt: nowISO } : b
        )
      );
      queueOrSync(
        { entity: 'boardComment', action: 'upsert', label: 'Posted team update' },
        user && board && board.ownerId !== 'local-user'
          ? async () => {
              const path = `boards/${boardId}/comments/${id}`;
              try {
                await setDoc(doc(db, 'boards', boardId, 'comments', id), {
                  boardId,
                  authorId: user.uid,
                  memberIds,
                  authorName,
                  body: trimmed,
                  createdAt: serverTimestamp(),
                });
              } catch (err) {
                handleFirestoreError(err, OperationType.CREATE, path);
              }
            }
          : undefined
      );
    },
    [boards, user, queueOrSync]
  );

  // --- Calendar Actions ---
  const addCalendarEvent = useCallback(
    (input: {
      title: string;
      eventType: CalendarEventType;
      date: string;
      startTime: string;
      endTime?: string;
      urgent: boolean;
      reminderMinutes: number;
      participants: string[];
    }) => {
      const id = makeId('ev');
      const ev: CalendarEvent = {
        id,
        ownerId: user?.uid || 'local-user',
        title: input.title.trim().slice(0, 120),
        eventType: input.eventType,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime || undefined,
        urgent: input.urgent,
        reminderMinutes: input.reminderMinutes,
        participants: input.participants.length > 0 ? input.participants : ['You'],
      };
      setCalendarEvents((prev) => [...prev, ev]);
      if (ev.urgent && notificationPrefs.urgentDeadlines) {
        pushAlert(
          'Urgent Calendar Reminder Set',
          `${ev.title} on ${ev.date} at ${ev.startTime} (${ev.reminderMinutes}m alert).`,
          'deadline'
        );
      }
      queueOrSync(
        { entity: 'calendarEvent', action: 'upsert', label: ev.title },
        user
          ? async () => {
              const path = `calendarEvents/${id}`;
              try {
                await setDoc(doc(db, 'calendarEvents', id), {
                  ownerId: user.uid,
                  participantIds: [user.uid],
                  title: ev.title,
                  eventType: ev.eventType,
                  date: ev.date,
                  startTime: ev.startTime,
                  ...(ev.endTime ? { endTime: ev.endTime } : {}),
                  urgent: ev.urgent,
                  reminderMinutes: ev.reminderMinutes,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              } catch (err) {
                handleFirestoreError(err, OperationType.CREATE, path);
              }
            }
          : undefined
      );
    },
    [user, notificationPrefs.urgentDeadlines, pushAlert, queueOrSync]
  );

  const deleteCalendarEvent = useCallback(
    (id: string) => {
      setCalendarEvents((prev) => prev.filter((e) => e.id !== id));
      queueOrSync(
        { entity: 'calendarEvent', action: 'delete', label: 'Removed calendar event' },
        user
          ? async () => {
              const path = `calendarEvents/${id}`;
              try {
                await deleteDoc(doc(db, 'calendarEvents', id));
              } catch (err) {
                handleFirestoreError(err, OperationType.DELETE, path);
              }
            }
          : undefined
      );
    },
    [user, queueOrSync]
  );

  // --- Widget & Notification Preferences ---
  const toggleWidgetVisibility = useCallback((id: WidgetId) => {
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)));
  }, []);

  const moveWidget = useCallback((id: WidgetId, direction: 'up' | 'down') => {
    setWidgets((prev) => {
      const idx = prev.findIndex((w) => w.id === id);
      if (idx === -1) return prev;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return next;
    });
  }, []);

  const toggleWidgetSize = useCallback((id: WidgetId) => {
    setWidgets((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, size: w.size === 'wide' ? 'compact' : 'wide' } : w
      )
    );
  }, []);

  const updateNotificationPrefs = useCallback((patch: Partial<NotificationPreferences>) => {
    setNotificationPrefs((prev) => ({ ...prev, ...patch }));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const value: WorkspaceContextValue = {
    todayISO,
    activeSection,
    setActiveSection,
    globalSearch,
    setGlobalSearch,
    user,
    authReady,
    authError,
    signInWithGoogle,
    signOutUser,
    isOnline: browserOnline,
    simulatedOffline,
    setSimulatedOffline,
    effectiveOnline,
    syncQueue,
    lastSyncedAt,
    flushSyncQueue,
    theme,
    toggleTheme,
    vaultLockEnabled,
    setVaultLockEnabled,
    isVaultLocked,
    lockVault,
    unlockVault,
    tasks,
    addTask,
    toggleTaskStatus,
    updateTaskStatus,
    deleteTask,
    habits,
    addHabit,
    toggleHabitToday,
    useHabitGracePeriod,
    toggleHabitPause,
    claimMilestoneReward,
    deleteHabit,
    expenses,
    budgetLimits,
    addExpense,
    deleteExpense,
    updateBudgetLimit,
    boards,
    addBoard,
    addBoardItem,
    moveBoardItemStatus,
    addBoardComment,
    calendarEvents,
    addCalendarEvent,
    deleteCalendarEvent,
    widgets,
    toggleWidgetVisibility,
    moveWidget,
    toggleWidgetSize,
    notificationPrefs,
    updateNotificationPrefs,
    notifications,
    markAllNotificationsRead,
    pushAlert,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
