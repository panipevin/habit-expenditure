import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
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
  createEmptyWorkspaceData,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_WIDGETS,
} from '../data/seed';
import {
  DEFAULT_BUDGET_LIMITS,
  DEFAULT_EXPENSE_CATEGORIES,
  formatINR,
  MAX_EXPENSE_CATEGORIES,
  normalizeExpenseCategories,
  sanitizeCategoryName,
} from '../utils/finance';
import {
  applyGracePeriod,
  claimHabitMilestone,
  evaluateHabitStreak,
  setHabitPauseState,
  toggleHabitCompletionForDate,
} from '../utils/streaks';
import {
  addViewerToAccessList,
  buildConnectedViewersList,
  generateShareInviteCode,
  isValidShareInviteCode,
  MAX_CONNECTED_VIEWERS,
  migrateLegacyWidgets,
  normalizeShareInviteCode,
  removeViewerFromAccessList,
  sanitizeDisplayName,
} from '../utils/sharing';
import { getTodayISO, isBeforeEveningCutoff } from '../utils/dates';
import type {
  AppSection,
  BudgetLimits,
  CalendarEvent,
  CalendarEventType,
  ConnectedViewer,
  DailyTask,
  Expense,
  ExpenseCategory,
  Habit,
  InAppNotification,
  NotificationPreferences,
  SharedAccountProfile,
  ShareInvite,
  SyncQueueItem,
  TaskPriority,
  TaskStatus,
  WidgetConfig,
  WidgetId,
} from '../types';

const LEGACY_STORAGE_KEY = 'cadence_workspace_state_v1';
const STORAGE_KEY = 'cadence_workspace_state_v2';

interface PersistedWorkspace {
  tasks: DailyTask[];
  habits: Habit[];
  expenses: Expense[];
  expenseCategories: ExpenseCategory[];
  budgetLimits: BudgetLimits;
  calendarEvents: CalendarEvent[];
  widgets: WidgetConfig[];
  notificationPrefs: NotificationPreferences;
  notifications: InAppNotification[];
  syncQueue: SyncQueueItem[];
  theme: 'light' | 'dark';
  vaultLockEnabled: boolean;
  lastSyncedAt: string;
}

function loadInitialWorkspace(): PersistedWorkspace {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedWorkspace>;
      return {
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        habits: Array.isArray(parsed.habits) ? parsed.habits : [],
        expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
        expenseCategories: normalizeExpenseCategories(
          parsed.expenseCategories,
          parsed.budgetLimits,
          Array.isArray(parsed.expenses) ? parsed.expenses : []
        ),
        budgetLimits: parsed.budgetLimits
          ? { ...parsed.budgetLimits }
          : { ...DEFAULT_BUDGET_LIMITS },
        calendarEvents: Array.isArray(parsed.calendarEvents) ? parsed.calendarEvents : [],
        widgets: migrateLegacyWidgets(parsed.widgets, DEFAULT_WIDGETS),
        notificationPrefs: parsed.notificationPrefs
          ? { ...DEFAULT_NOTIFICATION_PREFS, ...parsed.notificationPrefs }
          : DEFAULT_NOTIFICATION_PREFS,
        notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
        syncQueue: Array.isArray(parsed.syncQueue) ? parsed.syncQueue : [],
        theme: parsed.theme === 'dark' ? 'dark' : 'light',
        vaultLockEnabled: Boolean(parsed.vaultLockEnabled),
        lastSyncedAt: parsed.lastSyncedAt || new Date().toISOString(),
      };
    }
  } catch {
    // Fall back to empty clean workspace
  }

  const empty = createEmptyWorkspaceData();
  return {
    tasks: empty.tasks,
    habits: empty.habits,
    expenses: empty.expenses,
    expenseCategories: [...DEFAULT_EXPENSE_CATEGORIES],
    budgetLimits: { ...DEFAULT_BUDGET_LIMITS },
    calendarEvents: empty.calendarEvents,
    widgets: DEFAULT_WIDGETS,
    notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
    notifications: empty.notifications,
    syncQueue: [],
    theme: 'light',
    vaultLockEnabled: false,
    lastSyncedAt: new Date().toISOString(),
  };
}

function cleanBudgetLimitsMap(raw: unknown): BudgetLimits {
  const cleaned: BudgetLimits = {};
  if (!raw || typeof raw !== 'object') return cleaned;
  Object.entries(raw as Record<string, unknown>).forEach(([k, v]) => {
    const key = sanitizeCategoryName(k);
    const num = Number(v);
    if (key && Number.isFinite(num) && num >= 0) {
      cleaned[key] = Math.round(num);
    }
  });
  return cleaned;
}

function cleanViewerNamesMap(raw: unknown): Record<string, string> {
  const cleaned: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return cleaned;
  Object.entries(raw as Record<string, unknown>).forEach(([k, v]) => {
    if (typeof v === 'string' && k.trim()) {
      cleaned[k.trim()] = sanitizeDisplayName(v);
    }
  });
  return cleaned;
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

  // Family & Connected Read-Only Accounts
  viewingAccountId: string | null;
  isReadOnlyView: boolean;
  viewingAccountName: string | null;
  setViewingAccountId: (accountId: string | null) => void;
  connectedAccounts: SharedAccountProfile[];
  myViewers: ConnectedViewer[];
  activeInvite: ShareInvite | null;
  createShareInvite: () => Promise<{ ok: boolean; code?: string; error?: string }>;
  cancelShareInvite: () => Promise<void>;
  connectWithInviteCode: (
    rawCode: string
  ) => Promise<{ ok: boolean; connectedName?: string; error?: string }>;
  revokeViewerAccess: (viewerUid: string) => Promise<void>;

  // Theme
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // Biometric / Privacy Vault
  vaultLockEnabled: boolean;
  setVaultLockEnabled: (enabled: boolean) => void;
  isVaultLocked: boolean;
  lockVault: () => void;
  unlockVault: () => void;

  // Tasks (active account: own or read-only viewed family member)
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

  // Habits (active account)
  habits: Habit[];
  addHabit: (input: { name: string; category: string; reminderTime: string }) => void;
  toggleHabitToday: (id: string) => void;
  useHabitGracePeriod: (id: string) => { ok: boolean; message: string };
  toggleHabitPause: (id: string, paused: boolean, reason?: string) => void;
  claimMilestoneReward: (habitId: string, milestoneDays: number) => void;
  deleteHabit: (id: string) => void;

  // Expenses & Budgets (active account)
  expenses: Expense[];
  expenseCategories: ExpenseCategory[];
  budgetLimits: BudgetLimits;
  addExpense: (input: {
    title: string;
    category: ExpenseCategory;
    amount: number;
    date: string;
    note?: string;
  }) => void;
  updateExpense: (
    id: string,
    patch: {
      title?: string;
      category?: ExpenseCategory;
      amount?: number;
      date?: string;
      note?: string;
    }
  ) => void;
  deleteExpense: (id: string) => void;
  updateBudgetLimit: (category: ExpenseCategory, amount: number) => void;
  addExpenseCategory: (
    name: string,
    monthlyLimit?: number
  ) => { ok: boolean; error?: string; category?: ExpenseCategory };
  renameExpenseCategory: (
    oldName: string,
    newName: string,
    monthlyLimit?: number
  ) => { ok: boolean; error?: string; category?: ExpenseCategory };
  deleteExpenseCategory: (
    name: string,
    reassignTo?: ExpenseCategory
  ) => { ok: boolean; error?: string };

  // Calendar (active account)
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
  clearWorkspaceData: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const todayISO = useMemo(() => getTodayISO(), []);
  const initial = useMemo(() => loadInitialWorkspace(), []);

  const [activeSection, setActiveSection] = useState<AppSection>('dashboard');
  const [globalSearch, setGlobalSearch] = useState('');

  // Owner's own editable workspace state
  const [myTasks, setMyTasks] = useState<DailyTask[]>(initial.tasks);
  const [myHabits, setMyHabits] = useState<Habit[]>(initial.habits);
  const [myExpenses, setMyExpenses] = useState<Expense[]>(initial.expenses);
  const [myExpenseCategories, setMyExpenseCategories] = useState<ExpenseCategory[]>(
    initial.expenseCategories
  );
  const [myBudgetLimits, setMyBudgetLimits] = useState<BudgetLimits>(initial.budgetLimits);
  const [myCalendarEvents, setMyCalendarEvents] = useState<CalendarEvent[]>(initial.calendarEvents);

  // Connected family accounts & strict read-only viewing state
  const [viewingAccountId, setViewingAccountIdState] = useState<string | null>(null);
  const [myViewerIds, setMyViewerIds] = useState<string[]>([]);
  const [myViewerNames, setMyViewerNames] = useState<Record<string, string>>({});
  const [connectedAccounts, setConnectedAccounts] = useState<SharedAccountProfile[]>([]);
  const [activeInvite, setActiveInvite] = useState<ShareInvite | null>(null);

  const [viewedTasks, setViewedTasks] = useState<DailyTask[]>([]);
  const [viewedHabits, setViewedHabits] = useState<Habit[]>([]);
  const [viewedExpenses, setViewedExpenses] = useState<Expense[]>([]);
  const [viewedCalendarEvents, setViewedCalendarEvents] = useState<CalendarEvent[]>([]);

  const myViewerIdsRef = useRef<string[]>([]);
  const myViewerNamesRef = useRef<Record<string, string>>({});
  const myExpenseCategoriesRef = useRef<ExpenseCategory[]>(myExpenseCategories);
  const myBudgetLimitsRef = useRef<BudgetLimits>(myBudgetLimits);

  useEffect(() => {
    myViewerIdsRef.current = myViewerIds;
  }, [myViewerIds]);

  useEffect(() => {
    myViewerNamesRef.current = myViewerNames;
  }, [myViewerNames]);

  useEffect(() => {
    myExpenseCategoriesRef.current = myExpenseCategories;
  }, [myExpenseCategories]);

  useEffect(() => {
    myBudgetLimitsRef.current = myBudgetLimits;
  }, [myBudgetLimits]);

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
  const processingInvitesRef = useRef<Set<string>>(new Set());

  const viewedProfile = useMemo(
    () =>
      viewingAccountId
        ? connectedAccounts.find((acc) => acc.ownerId === viewingAccountId) || null
        : null,
    [connectedAccounts, viewingAccountId]
  );

  const isReadOnlyView = Boolean(viewingAccountId && viewedProfile);
  const viewingAccountName = viewedProfile?.displayName || null;

  const setViewingAccountId = useCallback((accountId: string | null) => {
    setViewingAccountIdState(accountId);
  }, []);

  // Auto-reset to own account if access was revoked or user signed out
  useEffect(() => {
    if (!viewingAccountId) return;
    if (!user) {
      setViewingAccountIdState(null);
      return;
    }
    const stillConnected = connectedAccounts.some((acc) => acc.ownerId === viewingAccountId);
    if (!stillConnected) {
      setViewingAccountIdState(null);
      setViewedTasks([]);
      setViewedHabits([]);
      setViewedExpenses([]);
      setViewedCalendarEvents([]);
    }
  }, [viewingAccountId, connectedAccounts, user]);

  // Sync HTML class for Tailwind v4 dark mode
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Persist owner's own workspace locally for offline-first continuity
  useEffect(() => {
    const payload: PersistedWorkspace = {
      tasks: myTasks,
      habits: myHabits,
      expenses: myExpenses,
      expenseCategories: myExpenseCategories,
      budgetLimits: myBudgetLimits,
      calendarEvents: myCalendarEvents,
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
    myTasks,
    myHabits,
    myExpenses,
    myExpenseCategories,
    myBudgetLimits,
    myCalendarEvents,
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
      if (!firebaseUser) {
        setViewingAccountIdState(null);
        setConnectedAccounts([]);
        setMyViewerIds([]);
        setMyViewerNames({});
        setActiveInvite(null);
        setViewedTasks([]);
        setViewedHabits([]);
        setViewedExpenses([]);
        setViewedCalendarEvents([]);
      }
    });
    return () => unsub();
  }, []);

  // Helper: propagate updated viewerIds onto all owner-owned Firestore docs so read-only access stays 100% consistent
  const syncViewerListToOwnedDocs = useCallback(
    async (ownerUid: string, nextViewerIds: string[]) => {
      const boundedViewers = Array.from(new Set(nextViewerIds.filter((id) => id && id !== ownerUid))).slice(
        0,
        MAX_CONNECTED_VIEWERS
      );
      const boundedParticipants = Array.from(new Set([ownerUid, ...boundedViewers])).slice(
        0,
        MAX_CONNECTED_VIEWERS
      );

      const tasksQuery = query(collection(db, `users/${ownerUid}/tasks`), where('ownerId', '==', ownerUid));
      const habitsQuery = query(collection(db, `users/${ownerUid}/habits`), where('ownerId', '==', ownerUid));
      const expensesQuery = query(
        collection(db, `users/${ownerUid}/expenses`),
        where('ownerId', '==', ownerUid)
      );
      const eventsQuery = query(collection(db, 'calendarEvents'), where('ownerId', '==', ownerUid));

      const [taskSnap, habitSnap, expenseSnap, eventSnap] = await Promise.all([
        getDocs(tasksQuery),
        getDocs(habitsQuery),
        getDocs(expensesQuery),
        getDocs(eventsQuery),
      ]);

      await Promise.allSettled([
        ...taskSnap.docs.map((d) =>
          updateDoc(doc(db, 'users', ownerUid, 'tasks', d.id), {
            viewerIds: boundedViewers,
            updatedAt: serverTimestamp(),
          })
        ),
        ...habitSnap.docs.map((d) =>
          updateDoc(doc(db, 'users', ownerUid, 'habits', d.id), {
            viewerIds: boundedViewers,
            updatedAt: serverTimestamp(),
          })
        ),
        ...expenseSnap.docs.map((d) =>
          updateDoc(doc(db, 'users', ownerUid, 'expenses', d.id), {
            viewerIds: boundedViewers,
            updatedAt: serverTimestamp(),
          })
        ),
        ...eventSnap.docs.map((d) =>
          updateDoc(doc(db, 'calendarEvents', d.id), {
            participantIds: boundedParticipants,
            updatedAt: serverTimestamp(),
          })
        ),
      ]);
    },
    []
  );

  // Helper: grant a connected family member strict read-only access to the current user's account
  const grantViewerAccess = useCallback(
    async (ownerUser: User, viewerUid: string, viewerName: string) => {
      const uid = ownerUser.uid;
      const sharedRef = doc(db, 'sharedProfiles', uid);
      const snap = await getDoc(sharedRef);

      const existingIds: string[] =
        snap.exists() && Array.isArray(snap.data().viewerIds)
          ? snap.data().viewerIds.filter((v: unknown): v is string => typeof v === 'string')
          : myViewerIdsRef.current;
      const existingNames: Record<string, string> = snap.exists()
        ? cleanViewerNamesMap(snap.data().viewerNames)
        : myViewerNamesRef.current;

      const { viewerIds, viewerNames, changed } = addViewerToAccessList(
        existingIds,
        existingNames,
        viewerUid,
        viewerName,
        uid
      );

      if (!changed) return;

      const displayName = sanitizeDisplayName(ownerUser.displayName, 'Workspace User');
      const boundedCats = myExpenseCategoriesRef.current.slice(0, MAX_EXPENSE_CATEGORIES);
      const boundedLimits = cleanBudgetLimitsMap(myBudgetLimitsRef.current);

      if (!snap.exists()) {
        await setDoc(sharedRef, {
          ownerId: uid,
          displayName,
          expenseCategories: boundedCats,
          budgetLimits: boundedLimits,
          viewerIds,
          viewerNames,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(sharedRef, {
          displayName,
          viewerIds,
          viewerNames,
          updatedAt: serverTimestamp(),
        });
      }

      setMyViewerIds(viewerIds);
      setMyViewerNames(viewerNames);
      await syncViewerListToOwnedDocs(uid, viewerIds);
    },
    [syncViewerListToOwnedDocs]
  );

  // Real-time Firestore listeners for owner's own workspace & family connections
  useEffect(() => {
    if (!authReady || !user) return;

    const uid = user.uid;
    const displayName = sanitizeDisplayName(user.displayName, 'Workspace User');
    const unsubs: (() => void)[] = [];

    // Ensure private user profile document exists
    const profileRef = doc(db, 'users', uid);
    void getDoc(profileRef)
      .then(async (snap) => {
        if (!snap.exists()) {
          await setDoc(profileRef, {
            uid,
            displayName,
            ...(user.email ? { email: user.email.slice(0, 160) } : {}),
            eveningCutoffHour: notificationPrefs.eveningCutoffHour,
            biometricEnabled: vaultLockEnabled,
            theme,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(profileRef, {
            displayName,
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

    // Ensure non-PII split shared profile document exists (preserves existing viewers!)
    const sharedProfileRef = doc(db, 'sharedProfiles', uid);
    void getDoc(sharedProfileRef)
      .then(async (snap) => {
        const boundedCats = myExpenseCategoriesRef.current.slice(0, MAX_EXPENSE_CATEGORIES);
        const boundedLimits = cleanBudgetLimitsMap(myBudgetLimitsRef.current);
        if (!snap.exists()) {
          await setDoc(sharedProfileRef, {
            ownerId: uid,
            displayName,
            expenseCategories: boundedCats,
            budgetLimits: boundedLimits,
            viewerIds: [],
            viewerNames: {},
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(sharedProfileRef, {
            displayName,
            updatedAt: serverTimestamp(),
          });
        }
      })
      .catch((err) => {
        handleFirestoreError(err, OperationType.WRITE, `sharedProfiles/${uid}`);
      });

    // Listen to private user profile (categories & budget limits)
    unsubs.push(
      onSnapshot(
        profileRef,
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data();
          if (Array.isArray(data.expenseCategories) && data.expenseCategories.length > 0) {
            const remoteCats = normalizeExpenseCategories(
              data.expenseCategories.filter((c: unknown): c is string => typeof c === 'string')
            );
            setMyExpenseCategories(remoteCats);
          }
          if (data.budgetLimits && typeof data.budgetLimits === 'object') {
            setMyBudgetLimits(cleanBudgetLimitsMap(data.budgetLimits));
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}`)
      )
    );

    // Listen to my own shared profile (who has read-only access to my account)
    unsubs.push(
      onSnapshot(
        sharedProfileRef,
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data();
          const ids = Array.isArray(data.viewerIds)
            ? data.viewerIds.filter((v: unknown): v is string => typeof v === 'string')
            : [];
          const names = cleanViewerNamesMap(data.viewerNames);
          setMyViewerIds(ids);
          setMyViewerNames(names);
        },
        (err) => handleFirestoreError(err, OperationType.GET, `sharedProfiles/${uid}`)
      )
    );

    // Listen to connected family accounts that granted ME read-only access
    unsubs.push(
      onSnapshot(
        query(collection(db, 'sharedProfiles'), where('viewerIds', 'array-contains', uid)),
        (snap) => {
          const accounts: SharedAccountProfile[] = snap.docs
            .filter((d) => d.id !== uid)
            .map((d) => {
              const data = d.data();
              const rawCats = Array.isArray(data.expenseCategories)
                ? data.expenseCategories.filter((c: unknown): c is string => typeof c === 'string')
                : [];
              return {
                ownerId: String(data.ownerId || d.id),
                displayName: sanitizeDisplayName(data.displayName, 'Family Account'),
                expenseCategories: normalizeExpenseCategories(
                  rawCats.length > 0 ? rawCats : DEFAULT_EXPENSE_CATEGORIES
                ),
                budgetLimits: cleanBudgetLimitsMap(data.budgetLimits),
                viewerIds: Array.isArray(data.viewerIds) ? data.viewerIds : [],
                viewerNames: cleanViewerNamesMap(data.viewerNames),
                updatedAt: new Date().toISOString(),
              };
            });
          setConnectedAccounts(accounts);
          setLastSyncedAt(new Date().toISOString());
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'sharedProfiles')
      )
    );

    // Listen to my created share invites -> automatically complete mutual read-only link when accepted
    unsubs.push(
      onSnapshot(
        query(collection(db, 'shareInvites'), where('creatorId', '==', uid)),
        (snap) => {
          let openInvite: ShareInvite | null = null;
          snap.docs.forEach((d) => {
            const data = d.data();
            const status = data.status === 'accepted' ? 'accepted' : 'open';
            const code = String(data.code || d.id);
            if (status === 'open' && !openInvite) {
              openInvite = {
                code,
                creatorId: String(data.creatorId || uid),
                creatorName: sanitizeDisplayName(data.creatorName, displayName),
                status: 'open',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
            }
            if (
              status === 'accepted' &&
              typeof data.acceptedByUid === 'string' &&
              data.acceptedByUid !== uid
            ) {
              const acceptedUid = data.acceptedByUid;
              const acceptedName = sanitizeDisplayName(data.acceptedByName, 'Family Member');
              if (!processingInvitesRef.current.has(code)) {
                processingInvitesRef.current.add(code);
                void grantViewerAccess(user, acceptedUid, acceptedName)
                  .then(async () => {
                    await deleteDoc(doc(db, 'shareInvites', code));
                    pushAlert(
                      'Family Account Linked',
                      `${acceptedName} connected with your share code. You can now view each other's accounts in read-only mode.`,
                      'family'
                    );
                  })
                  .catch((err) => {
                    processingInvitesRef.current.delete(code);
                    handleFirestoreError(err, OperationType.UPDATE, `shareInvites/${code}`);
                  });
              }
            }
          });
          setActiveInvite(openInvite);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'shareInvites')
      )
    );

    // 1. Owner's Personal Tasks listener
    const tasksPath = `users/${uid}/tasks`;
    unsubs.push(
      onSnapshot(
        query(collection(db, tasksPath), where('ownerId', '==', uid)),
        (snap) => {
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
          setMyTasks(remoteTasks);
          setLastSyncedAt(new Date().toISOString());
        },
        (err) => handleFirestoreError(err, OperationType.LIST, tasksPath)
      )
    );

    // 2. Owner's Personal Habits listener
    const habitsPath = `users/${uid}/habits`;
    unsubs.push(
      onSnapshot(
        query(collection(db, habitsPath), where('ownerId', '==', uid)),
        (snap) => {
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
              graceTokensRemaining:
                typeof data.graceTokensRemaining === 'number' ? data.graceTokensRemaining : 2,
              isPaused: Boolean(data.isPaused),
              pauseReason: data.pauseReason ? String(data.pauseReason) : undefined,
              pausedSince: data.pausedSince ? String(data.pausedSince) : undefined,
              claimedMilestones: Array.isArray(data.claimedMilestones) ? data.claimedMilestones : [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
          });
          setMyHabits(remoteHabits);
          setLastSyncedAt(new Date().toISOString());
        },
        (err) => handleFirestoreError(err, OperationType.LIST, habitsPath)
      )
    );

    // 3. Owner's Personal Expenses listener
    const expensesPath = `users/${uid}/expenses`;
    unsubs.push(
      onSnapshot(
        query(collection(db, expensesPath), where('ownerId', '==', uid)),
        (snap) => {
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
          setMyExpenses(remoteExpenses);
          setLastSyncedAt(new Date().toISOString());
        },
        (err) => handleFirestoreError(err, OperationType.LIST, expensesPath)
      )
    );

    // 4. Owner's Integrated Calendar Events listener (strictly own events)
    const calPath = 'calendarEvents';
    unsubs.push(
      onSnapshot(
        query(collection(db, calPath), where('ownerId', '==', uid)),
        (snap) => {
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
          setMyCalendarEvents(remoteEvents);
          setLastSyncedAt(new Date().toISOString());
        },
        (err) => handleFirestoreError(err, OperationType.LIST, calPath)
      )
    );

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [
    authReady,
    user,
    todayISO,
    notificationPrefs.eveningCutoffHour,
    theme,
    vaultLockEnabled,
    grantViewerAccess,
    pushAlert,
  ]);

  // Real-time READ-ONLY Firestore listeners when viewing a connected family member's account
  useEffect(() => {
    if (!authReady || !user || !viewingAccountId) {
      setViewedTasks([]);
      setViewedHabits([]);
      setViewedExpenses([]);
      setViewedCalendarEvents([]);
      return;
    }

    const myUid = user.uid;
    const targetUid = viewingAccountId;
    const unsubs: (() => void)[] = [];

    const tasksPath = `users/${targetUid}/tasks`;
    unsubs.push(
      onSnapshot(
        query(collection(db, tasksPath), where('viewerIds', 'array-contains', myUid)),
        (snap) => {
          setViewedTasks(
            snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                ownerId: String(data.ownerId || targetUid),
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
            })
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, tasksPath)
      )
    );

    const habitsPath = `users/${targetUid}/habits`;
    unsubs.push(
      onSnapshot(
        query(collection(db, habitsPath), where('viewerIds', 'array-contains', myUid)),
        (snap) => {
          setViewedHabits(
            snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                ownerId: String(data.ownerId || targetUid),
                name: String(data.name || ''),
                category: String(data.category || 'Focus'),
                reminderTime: String(data.reminderTime || '08:00'),
                completedDates: Array.isArray(data.completedDates) ? data.completedDates : [],
                graceDates: Array.isArray(data.graceDates) ? data.graceDates : [],
                graceTokensRemaining:
                  typeof data.graceTokensRemaining === 'number' ? data.graceTokensRemaining : 2,
                isPaused: Boolean(data.isPaused),
                pauseReason: data.pauseReason ? String(data.pauseReason) : undefined,
                pausedSince: data.pausedSince ? String(data.pausedSince) : undefined,
                claimedMilestones: Array.isArray(data.claimedMilestones)
                  ? data.claimedMilestones
                  : [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
            })
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, habitsPath)
      )
    );

    const expensesPath = `users/${targetUid}/expenses`;
    unsubs.push(
      onSnapshot(
        query(collection(db, expensesPath), where('viewerIds', 'array-contains', myUid)),
        (snap) => {
          setViewedExpenses(
            snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                ownerId: String(data.ownerId || targetUid),
                title: String(data.title || ''),
                category: (data.category || 'Food') as ExpenseCategory,
                amount: Number(data.amount || 0),
                date: String(data.date || todayISO),
                note: data.note ? String(data.note) : undefined,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
            })
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, expensesPath)
      )
    );

    const calPath = 'calendarEvents';
    unsubs.push(
      onSnapshot(
        query(collection(db, calPath), where('participantIds', 'array-contains', myUid)),
        (snap) => {
          setViewedCalendarEvents(
            snap.docs
              .filter((d) => d.data().ownerId === targetUid)
              .map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  ownerId: String(data.ownerId || targetUid),
                  title: String(data.title || ''),
                  eventType: (data.eventType || 'meeting') as CalendarEventType,
                  date: String(data.date || todayISO),
                  startTime: String(data.startTime || '09:00'),
                  endTime: data.endTime ? String(data.endTime) : undefined,
                  urgent: Boolean(data.urgent),
                  reminderMinutes: Number(data.reminderMinutes ?? 15),
                  participants: [viewingAccountName || 'Family Member'],
                };
              })
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, calPath)
      )
    );

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [authReady, user, viewingAccountId, todayISO, viewingAccountName]);

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
    setViewingAccountIdState(null);
    await signOut(auth);
  }, []);

  // --- Family Sharing Actions ---
  const createShareInvite = useCallback(async (): Promise<{
    ok: boolean;
    code?: string;
    error?: string;
  }> => {
    if (!user) {
      return { ok: false, error: 'Sign in with Google first to generate a family share code.' };
    }
    if (!effectiveOnline) {
      return { ok: false, error: 'Connect to the internet to generate a live share code.' };
    }

    try {
      if (activeInvite) {
        await deleteDoc(doc(db, 'shareInvites', activeInvite.code)).catch(() => {});
      }

      const code = generateShareInviteCode(6);
      const creatorName = sanitizeDisplayName(user.displayName, 'Workspace User');
      await setDoc(doc(db, 'shareInvites', code), {
        code,
        creatorId: user.uid,
        creatorName,
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return { ok: true, code };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'shareInvites');
      return { ok: false, error: 'Could not generate a share code right now. Please try again.' };
    }
  }, [user, effectiveOnline, activeInvite]);

  const cancelShareInvite = useCallback(async () => {
    if (!user || !activeInvite) return;
    try {
      await deleteDoc(doc(db, 'shareInvites', activeInvite.code));
      setActiveInvite(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `shareInvites/${activeInvite.code}`);
    }
  }, [user, activeInvite]);

  const connectWithInviteCode = useCallback(
    async (
      rawCode: string
    ): Promise<{ ok: boolean; connectedName?: string; error?: string }> => {
      if (!user) {
        return { ok: false, error: 'Sign in with Google first to link with a family account.' };
      }
      if (!effectiveOnline) {
        return { ok: false, error: 'Connect to the internet to link accounts.' };
      }

      const code = normalizeShareInviteCode(rawCode);
      if (!isValidShareInviteCode(code)) {
        return { ok: false, error: 'Enter a valid 6-character share code.' };
      }

      const inviteRef = doc(db, 'shareInvites', code);
      try {
        const snap = await getDoc(inviteRef);
        if (!snap.exists()) {
          return {
            ok: false,
            error: 'Share code not found or already used. Ask the other person to generate a fresh code.',
          };
        }

        const data = snap.data();
        if (data.status !== 'open') {
          return { ok: false, error: 'This share code has already been used.' };
        }
        if (data.creatorId === user.uid) {
          return {
            ok: false,
            error: 'You cannot enter your own share code. Share it with your sister or family member on their phone.',
          };
        }

        const creatorUid = String(data.creatorId);
        const creatorName = sanitizeDisplayName(data.creatorName, 'Family Account');
        const myName = sanitizeDisplayName(user.displayName, 'Workspace User');

        // 1. Mark invite accepted so creator's device automatically grants us read-only access
        await updateDoc(inviteRef, {
          status: 'accepted',
          acceptedByUid: user.uid,
          acceptedByName: myName,
          updatedAt: serverTimestamp(),
        });

        // 2. Immediately grant the invite creator read-only access to our own account
        await grantViewerAccess(user, creatorUid, creatorName);

        pushAlert(
          'Connected for Read-Only Viewing',
          `You linked with ${creatorName}. Once their app syncs, both of you can view each other's tasks, habits, calendar, and expenses (read-only).`,
          'family'
        );

        return { ok: true, connectedName: creatorName };
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `shareInvites/${code}`);
        return {
          ok: false,
          error: 'Could not link with that code. Verify the code and make sure both accounts are signed in with Google.',
        };
      }
    },
    [user, effectiveOnline, grantViewerAccess, pushAlert]
  );

  const revokeViewerAccess = useCallback(
    async (viewerUid: string) => {
      if (!user) return;
      const uid = user.uid;
      const { viewerIds, viewerNames } = removeViewerFromAccessList(
        myViewerIdsRef.current,
        myViewerNamesRef.current,
        viewerUid
      );
      setMyViewerIds(viewerIds);
      setMyViewerNames(viewerNames);

      try {
        await updateDoc(doc(db, 'sharedProfiles', uid), {
          viewerIds,
          viewerNames,
          updatedAt: serverTimestamp(),
        });
        await syncViewerListToOwnedDocs(uid, viewerIds);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `sharedProfiles/${uid}`);
      }
    },
    [user, syncViewerListToOwnedDocs]
  );

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

  // --- Task Actions (strictly disabled in read-only view) ---
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
      if (isReadOnlyView) return;
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

      setMyTasks((prev) => [newTask, ...prev]);

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
                  viewerIds: myViewerIdsRef.current.slice(0, MAX_CONNECTED_VIEWERS),
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
    [
      isReadOnlyView,
      user,
      notificationPrefs.eveningCutoffHour,
      notificationPrefs.urgentDeadlines,
      pushAlert,
      queueOrSync,
    ]
  );

  const updateTaskStatus = useCallback(
    (id: string, status: TaskStatus) => {
      if (isReadOnlyView) return;
      setMyTasks((prev) =>
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
    [isReadOnlyView, user, queueOrSync]
  );

  const toggleTaskStatus = useCallback(
    (id: string) => {
      if (isReadOnlyView) return;
      const current = myTasks.find((t) => t.id === id);
      const nextStatus: TaskStatus = current?.status === 'done' ? 'todo' : 'done';
      updateTaskStatus(id, nextStatus);
    },
    [isReadOnlyView, myTasks, updateTaskStatus]
  );

  const deleteTask = useCallback(
    (id: string) => {
      if (isReadOnlyView) return;
      setMyTasks((prev) => prev.filter((t) => t.id !== id));
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
    [isReadOnlyView, user, queueOrSync]
  );

  // --- Gamified Habit Actions (strictly disabled in read-only view) ---
  const addHabit = useCallback(
    (input: { name: string; category: string; reminderTime: string }) => {
      if (isReadOnlyView) return;
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
      setMyHabits((prev) => [newHabit, ...prev]);
      queueOrSync(
        { entity: 'habit', action: 'upsert', label: newHabit.name },
        user
          ? async () => {
              const path = `users/${user.uid}/habits/${id}`;
              try {
                await setDoc(doc(db, 'users', user.uid, 'habits', id), {
                  ownerId: user.uid,
                  viewerIds: myViewerIdsRef.current.slice(0, MAX_CONNECTED_VIEWERS),
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
    [isReadOnlyView, user, queueOrSync]
  );

  const toggleHabitToday = useCallback(
    (id: string) => {
      if (isReadOnlyView) return;
      const target = myHabits.find((h) => h.id === id);
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

      setMyHabits((prev) => prev.map((h) => (h.id === id ? updated : h)));
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
    [isReadOnlyView, myHabits, todayISO, pushAlert, user, queueOrSync]
  );

  const useHabitGracePeriod = useCallback(
    (id: string): { ok: boolean; message: string } => {
      if (isReadOnlyView) return { ok: false, message: 'Read-only view.' };
      const target = myHabits.find((h) => h.id === id);
      if (!target) return { ok: false, message: 'Habit not found.' };
      const res = applyGracePeriod(target, todayISO);
      if (!res.appliedDate) {
        return { ok: false, message: res.reason || 'Grace shield unavailable.' };
      }

      setMyHabits((prev) => prev.map((h) => (h.id === id ? res.habit : h)));
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
    [isReadOnlyView, myHabits, todayISO, user, queueOrSync]
  );

  const toggleHabitPause = useCallback(
    (id: string, paused: boolean, reason?: string) => {
      if (isReadOnlyView) return;
      const target = myHabits.find((h) => h.id === id);
      if (!target) return;
      const updated = setHabitPauseState(target, paused, todayISO, reason);
      setMyHabits((prev) => prev.map((h) => (h.id === id ? updated : h)));
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
    [isReadOnlyView, myHabits, todayISO, user, queueOrSync]
  );

  const claimMilestoneReward = useCallback(
    (habitId: string, milestoneDays: number) => {
      if (isReadOnlyView) return;
      const target = myHabits.find((h) => h.id === habitId);
      if (!target) return;
      const updated = claimHabitMilestone(target, milestoneDays);
      setMyHabits((prev) => prev.map((h) => (h.id === habitId ? updated : h)));
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
    [isReadOnlyView, myHabits, user, queueOrSync]
  );

  const deleteHabit = useCallback(
    (id: string) => {
      if (isReadOnlyView) return;
      setMyHabits((prev) => prev.filter((h) => h.id !== id));
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
    [isReadOnlyView, user, queueOrSync]
  );

  // Sync expense categories & budgets to both private /users/{uid} and non-PII /sharedProfiles/{uid}
  const syncCategoryPreferencesToCloud = useCallback(
    (nextCategories: ExpenseCategory[], nextLimits: BudgetLimits, label: string) => {
      const boundedCats = nextCategories
        .map((c) => sanitizeCategoryName(c))
        .filter(Boolean)
        .slice(0, MAX_EXPENSE_CATEGORIES);
      const boundedLimits: BudgetLimits = {};
      boundedCats.forEach((cat) => {
        const val = nextLimits[cat];
        if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
          boundedLimits[cat] = Math.round(val);
        }
      });

      queueOrSync(
        { entity: 'expense', action: 'upsert', label },
        user
          ? async () => {
              const userPath = `users/${user.uid}`;
              const sharedPath = `sharedProfiles/${user.uid}`;
              try {
                await Promise.all([
                  updateDoc(doc(db, 'users', user.uid), {
                    expenseCategories: boundedCats,
                    budgetLimits: boundedLimits,
                    updatedAt: serverTimestamp(),
                  }),
                  updateDoc(doc(db, 'sharedProfiles', user.uid), {
                    expenseCategories: boundedCats,
                    budgetLimits: boundedLimits,
                    updatedAt: serverTimestamp(),
                  }).catch(() => {}),
                ]);
              } catch (err) {
                handleFirestoreError(err, OperationType.UPDATE, `${userPath} / ${sharedPath}`);
              }
            }
          : undefined
      );
    },
    [user, queueOrSync]
  );

  // --- Expense & Budget Actions (strictly disabled in read-only view) ---
  const addExpense = useCallback(
    (input: {
      title: string;
      category: ExpenseCategory;
      amount: number;
      date: string;
      note?: string;
    }) => {
      if (isReadOnlyView) return;
      const id = makeId('exp');
      const nowISO = new Date().toISOString();
      const cleanCategory =
        sanitizeCategoryName(input.category) || myExpenseCategories[0] || 'Food';
      const entry: Expense = {
        id,
        ownerId: user?.uid || 'local-user',
        title: input.title.trim().slice(0, 120),
        category: cleanCategory,
        amount: Math.round(input.amount * 100) / 100,
        date: input.date,
        note: input.note?.trim().slice(0, 240) || undefined,
        createdAt: nowISO,
        updatedAt: nowISO,
      };
      setMyExpenses((prev) => [entry, ...prev]);

      if (notificationPrefs.budgetThresholdAlerts) {
        const monthPrefix = input.date.slice(0, 7);
        const currentCategoryTotal =
          myExpenses
            .filter((e) => e.category === cleanCategory && e.date.startsWith(monthPrefix))
            .reduce((sum, e) => sum + e.amount, 0) + entry.amount;
        const limit = myBudgetLimits[cleanCategory];
        if (limit > 0 && currentCategoryTotal > limit) {
          pushAlert(
            `${cleanCategory} Budget Exceeded`,
            `Monthly ${cleanCategory} spend reached ${formatINR(currentCategoryTotal)} (limit ${formatINR(limit)}).`,
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
                  viewerIds: myViewerIdsRef.current.slice(0, MAX_CONNECTED_VIEWERS),
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
    [
      isReadOnlyView,
      user,
      myExpenses,
      myExpenseCategories,
      myBudgetLimits,
      notificationPrefs.budgetThresholdAlerts,
      pushAlert,
      queueOrSync,
    ]
  );

  const updateExpense = useCallback(
    (
      id: string,
      patch: {
        title?: string;
        category?: ExpenseCategory;
        amount?: number;
        date?: string;
        note?: string;
      }
    ) => {
      if (isReadOnlyView) return;
      const target = myExpenses.find((e) => e.id === id);
      if (!target) return;

      const nextTitle =
        patch.title !== undefined ? patch.title.trim().slice(0, 120) || target.title : target.title;
      const nextCategory =
        patch.category !== undefined
          ? sanitizeCategoryName(patch.category) || target.category
          : target.category;
      const nextAmount =
        patch.amount !== undefined && Number.isFinite(patch.amount) && patch.amount > 0
          ? Math.round(patch.amount * 100) / 100
          : target.amount;
      const nextDate =
        patch.date !== undefined && patch.date.length === 10 ? patch.date : target.date;
      const nextNote =
        patch.note !== undefined ? patch.note.trim().slice(0, 240) || undefined : target.note;

      const updated: Expense = {
        ...target,
        title: nextTitle,
        category: nextCategory,
        amount: nextAmount,
        date: nextDate,
        note: nextNote,
        updatedAt: new Date().toISOString(),
      };

      setMyExpenses((prev) => prev.map((e) => (e.id === id ? updated : e)));

      queueOrSync(
        { entity: 'expense', action: 'upsert', label: `Updated expense ${updated.title}` },
        user
          ? async () => {
              const path = `users/${user.uid}/expenses/${id}`;
              try {
                await updateDoc(doc(db, 'users', user.uid, 'expenses', id), {
                  title: updated.title,
                  category: updated.category,
                  amount: updated.amount,
                  date: updated.date,
                  note: updated.note ? updated.note : deleteField(),
                  updatedAt: serverTimestamp(),
                });
              } catch (err) {
                handleFirestoreError(err, OperationType.UPDATE, path);
              }
            }
          : undefined
      );
    },
    [isReadOnlyView, myExpenses, user, queueOrSync]
  );

  const deleteExpense = useCallback(
    (id: string) => {
      if (isReadOnlyView) return;
      setMyExpenses((prev) => prev.filter((e) => e.id !== id));
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
    [isReadOnlyView, user, queueOrSync]
  );

  const updateBudgetLimit = useCallback(
    (category: ExpenseCategory, amount: number) => {
      if (isReadOnlyView) return;
      const safeAmount = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
      const nextLimits: BudgetLimits = {
        ...myBudgetLimits,
        [category]: safeAmount,
      };
      setMyBudgetLimits(nextLimits);
      syncCategoryPreferencesToCloud(myExpenseCategories, nextLimits, `Updated ${category} budget`);
    },
    [isReadOnlyView, myBudgetLimits, myExpenseCategories, syncCategoryPreferencesToCloud]
  );

  const addExpenseCategory = useCallback(
    (
      name: string,
      monthlyLimit = 0
    ): { ok: boolean; error?: string; category?: ExpenseCategory } => {
      if (isReadOnlyView) return { ok: false, error: 'Read-only view.' };
      const clean = sanitizeCategoryName(name);
      if (!clean) {
        return { ok: false, error: 'Enter a category name.' };
      }
      if (myExpenseCategories.length >= MAX_EXPENSE_CATEGORIES) {
        return {
          ok: false,
          error: `Maximum of ${MAX_EXPENSE_CATEGORIES} expense categories reached.`,
        };
      }
      if (myExpenseCategories.some((c) => c.toLowerCase() === clean.toLowerCase())) {
        return { ok: false, error: `"${clean}" already exists.` };
      }

      const safeLimit = Number.isFinite(monthlyLimit) ? Math.max(0, Math.round(monthlyLimit)) : 0;
      const nextCategories = [...myExpenseCategories, clean];
      const nextLimits: BudgetLimits = {
        ...myBudgetLimits,
        [clean]: safeLimit,
      };

      setMyExpenseCategories(nextCategories);
      setMyBudgetLimits(nextLimits);
      syncCategoryPreferencesToCloud(nextCategories, nextLimits, `Added category ${clean}`);
      return { ok: true, category: clean };
    },
    [isReadOnlyView, myExpenseCategories, myBudgetLimits, syncCategoryPreferencesToCloud]
  );

  const renameExpenseCategory = useCallback(
    (
      oldName: string,
      newName: string,
      monthlyLimit?: number
    ): { ok: boolean; error?: string; category?: ExpenseCategory } => {
      if (isReadOnlyView) return { ok: false, error: 'Read-only view.' };
      const cleanNew = sanitizeCategoryName(newName);
      if (!cleanNew) {
        return { ok: false, error: 'Category name cannot be empty.' };
      }
      if (!myExpenseCategories.includes(oldName)) {
        return { ok: false, error: 'Category not found.' };
      }
      const duplicate = myExpenseCategories.some(
        (c) => c !== oldName && c.toLowerCase() === cleanNew.toLowerCase()
      );
      if (duplicate) {
        return { ok: false, error: `"${cleanNew}" already exists.` };
      }

      const nextCategories = myExpenseCategories.map((c) => (c === oldName ? cleanNew : c));
      const nextLimits: BudgetLimits = { ...myBudgetLimits };
      const existingLimit = nextLimits[oldName] ?? 0;
      if (oldName !== cleanNew) {
        delete nextLimits[oldName];
      }
      nextLimits[cleanNew] =
        monthlyLimit !== undefined && Number.isFinite(monthlyLimit)
          ? Math.max(0, Math.round(monthlyLimit))
          : existingLimit;

      setMyExpenseCategories(nextCategories);
      setMyBudgetLimits(nextLimits);
      syncCategoryPreferencesToCloud(nextCategories, nextLimits, `Edited category ${cleanNew}`);

      if (oldName !== cleanNew) {
        const affected = myExpenses.filter((e) => e.category === oldName);
        if (affected.length > 0) {
          const nowISO = new Date().toISOString();
          setMyExpenses((prev) =>
            prev.map((e) =>
              e.category === oldName ? { ...e, category: cleanNew, updatedAt: nowISO } : e
            )
          );
          queueOrSync(
            {
              entity: 'expense',
              action: 'upsert',
              label: `Renamed ${affected.length} expense(s) to ${cleanNew}`,
            },
            user
              ? async () => {
                  await Promise.all(
                    affected.map(async (exp) => {
                      const path = `users/${user.uid}/expenses/${exp.id}`;
                      try {
                        await updateDoc(doc(db, 'users', user.uid, 'expenses', exp.id), {
                          category: cleanNew,
                          updatedAt: serverTimestamp(),
                        });
                      } catch (err) {
                        handleFirestoreError(err, OperationType.UPDATE, path);
                      }
                    })
                  );
                }
              : undefined
          );
        }
      }

      return { ok: true, category: cleanNew };
    },
    [
      isReadOnlyView,
      myExpenseCategories,
      myBudgetLimits,
      myExpenses,
      user,
      queueOrSync,
      syncCategoryPreferencesToCloud,
    ]
  );

  const deleteExpenseCategory = useCallback(
    (name: string, reassignTo?: ExpenseCategory): { ok: boolean; error?: string } => {
      if (isReadOnlyView) return { ok: false, error: 'Read-only view.' };
      if (myExpenseCategories.length <= 1) {
        return { ok: false, error: 'Keep at least one expense category.' };
      }
      if (!myExpenseCategories.includes(name)) {
        return { ok: false, error: 'Category not found.' };
      }

      const nextCategories = myExpenseCategories.filter((c) => c !== name);
      const fallbackCategory =
        reassignTo && nextCategories.includes(reassignTo) ? reassignTo : nextCategories[0];
      const nextLimits: BudgetLimits = { ...myBudgetLimits };
      delete nextLimits[name];

      setMyExpenseCategories(nextCategories);
      setMyBudgetLimits(nextLimits);
      syncCategoryPreferencesToCloud(nextCategories, nextLimits, `Removed category ${name}`);

      const affected = myExpenses.filter((e) => e.category === name);
      if (affected.length > 0) {
        const nowISO = new Date().toISOString();
        setMyExpenses((prev) =>
          prev.map((e) =>
            e.category === name ? { ...e, category: fallbackCategory, updatedAt: nowISO } : e
          )
        );
        queueOrSync(
          {
            entity: 'expense',
            action: 'upsert',
            label: `Moved ${affected.length} expense(s) to ${fallbackCategory}`,
          },
          user
            ? async () => {
                await Promise.all(
                  affected.map(async (exp) => {
                    const path = `users/${user.uid}/expenses/${exp.id}`;
                    try {
                      await updateDoc(doc(db, 'users', user.uid, 'expenses', exp.id), {
                        category: fallbackCategory,
                        updatedAt: serverTimestamp(),
                      });
                    } catch (err) {
                      handleFirestoreError(err, OperationType.UPDATE, path);
                    }
                  })
                );
              }
            : undefined
        );
      }

      return { ok: true };
    },
    [
      isReadOnlyView,
      myExpenseCategories,
      myBudgetLimits,
      myExpenses,
      user,
      queueOrSync,
      syncCategoryPreferencesToCloud,
    ]
  );

  // --- Calendar Actions (strictly disabled in read-only view) ---
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
      if (isReadOnlyView) return;
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
      setMyCalendarEvents((prev) => [...prev, ev]);
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
              const participantIds = Array.from(
                new Set([user.uid, ...myViewerIdsRef.current])
              ).slice(0, MAX_CONNECTED_VIEWERS);
              try {
                await setDoc(doc(db, 'calendarEvents', id), {
                  ownerId: user.uid,
                  participantIds,
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
    [isReadOnlyView, user, notificationPrefs.urgentDeadlines, pushAlert, queueOrSync]
  );

  const deleteCalendarEvent = useCallback(
    (id: string) => {
      if (isReadOnlyView) return;
      setMyCalendarEvents((prev) => prev.filter((e) => e.id !== id));
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
    [isReadOnlyView, user, queueOrSync]
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

  const clearWorkspaceData = useCallback(() => {
    pendingCloudActionsRef.current = [];
    setMyTasks([]);
    setMyHabits([]);
    setMyExpenses([]);
    setMyCalendarEvents([]);
    setNotifications([]);
    setSyncQueue([]);
    setMyExpenseCategories([...DEFAULT_EXPENSE_CATEGORIES]);
    setMyBudgetLimits({ ...DEFAULT_BUDGET_LIMITS });
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Unified active dataset: switches transparently between My Account (editable) and Connected Account (read-only)
  const tasks = isReadOnlyView ? viewedTasks : myTasks;
  const habits = isReadOnlyView ? viewedHabits : myHabits;
  const expenses = isReadOnlyView ? viewedExpenses : myExpenses;
  const expenseCategories = useMemo(
    () =>
      isReadOnlyView && viewedProfile
        ? normalizeExpenseCategories(
            viewedProfile.expenseCategories,
            viewedProfile.budgetLimits,
            viewedExpenses
          )
        : myExpenseCategories,
    [isReadOnlyView, viewedProfile, viewedExpenses, myExpenseCategories]
  );
  const budgetLimits = useMemo(
    () => (isReadOnlyView && viewedProfile ? viewedProfile.budgetLimits : myBudgetLimits),
    [isReadOnlyView, viewedProfile, myBudgetLimits]
  );
  const calendarEvents = isReadOnlyView ? viewedCalendarEvents : myCalendarEvents;
  const myViewers = useMemo(
    () => buildConnectedViewersList(myViewerIds, myViewerNames),
    [myViewerIds, myViewerNames]
  );

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
    viewingAccountId,
    isReadOnlyView,
    viewingAccountName,
    setViewingAccountId,
    connectedAccounts,
    myViewers,
    activeInvite,
    createShareInvite,
    cancelShareInvite,
    connectWithInviteCode,
    revokeViewerAccess,
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
    expenseCategories,
    budgetLimits,
    addExpense,
    updateExpense,
    deleteExpense,
    updateBudgetLimit,
    addExpenseCategory,
    renameExpenseCategory,
    deleteExpenseCategory,
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
    clearWorkspaceData,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
