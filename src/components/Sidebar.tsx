import React from 'react';
import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  Cloud,
  CloudOff,
  Flame,
  KanbanSquare,
  LayoutGrid,
  Lock,
  Settings,
  Wallet,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import type { AppSection } from '../types';
import { evaluateHabitStreak } from '../utils/streaks';

const NAV_ITEMS: { id: AppSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Overview', icon: LayoutGrid },
  { id: 'tasks', label: 'Daily Tasks', icon: CheckSquare },
  { id: 'habits', label: 'Habit Streaks', icon: Flame },
  { id: 'boards', label: 'Team Boards', icon: KanbanSquare },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'expenses', label: 'Expenses', icon: Wallet },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Security & Sync', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const {
    activeSection,
    setActiveSection,
    tasks,
    habits,
    todayISO,
    user,
    effectiveOnline,
    syncQueue,
    vaultLockEnabled,
    lockVault,
  } = useWorkspace();

  const pendingTaskCount = tasks.filter((t) => t.status !== 'done').length;
  const topStreak = habits.reduce((max, h) => {
    const s = evaluateHabitStreak(h, todayISO).currentStreak;
    return s > max ? s : max;
  }, 0);

  return (
    <aside
      aria-label="Primary workspace navigation"
      className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen bg-white dark:bg-[#121722] border-r border-[#E2E6ED] dark:border-[#1F2737]"
    >
      {/* Brand Wordmark */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-[#E2E6ED] dark:border-[#1F2737]">
        <button
          type="button"
          onClick={() => setActiveSection('dashboard')}
          className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] rounded-md"
        >
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#0E1525] dark:bg-[#1D4ED8] text-white font-display font-bold text-sm">
            C
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-[#0E1525] dark:text-[#F1F5F9] whitespace-nowrap shrink-0">
            Cadence
          </span>
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-[#1D4ED8]/10 text-[#1D4ED8] dark:bg-[#3B82F6]/15 dark:text-[#60A5FA]'
                  : 'text-[#556075] dark:text-[#94A3B8] hover:text-[#0E1525] dark:hover:text-[#F1F5F9] hover:bg-[#F6F7F9] dark:hover:bg-[#1A2130]'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${item.id === 'habits' && active ? 'text-[#EA580C] dark:text-[#F59E0B]' : ''}`} />
                <span className="truncate">{item.label}</span>
              </span>
              {item.id === 'tasks' && pendingTaskCount > 0 && (
                <span className="font-mono text-xs tabular-nums text-[#556075] dark:text-[#8B97AD]">
                  {pendingTaskCount}
                </span>
              )}
              {item.id === 'habits' && topStreak > 0 && (
                <span className="font-mono text-xs tabular-nums text-[#D97706] dark:text-[#F59E0B]">
                  {topStreak}d
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Sync & Account Footer */}
      <div className="p-4 border-t border-[#E2E6ED] dark:border-[#1F2737] space-y-3">
        <div className="flex items-center justify-between text-xs text-[#556075] dark:text-[#94A3B8]">
          <span className="flex items-center gap-2 min-w-0">
            {effectiveOnline ? (
              <Cloud className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
            ) : (
              <CloudOff className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
            )}
            <span className="truncate">
              {effectiveOnline
                ? user
                  ? 'Cloud synced'
                  : 'Local offline-ready'
                : `Offline (${syncQueue.length} queued)`}
            </span>
          </span>
          {vaultLockEnabled && (
            <button
              type="button"
              onClick={lockVault}
              aria-label="Lock workspace vault"
              className="p-1.5 rounded-md hover:bg-[#F6F7F9] dark:hover:bg-[#1A2130] text-[#556075] dark:text-[#94A3B8]"
              title="Lock Vault"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setActiveSection('settings')}
          className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-[#F6F7F9] dark:hover:bg-[#1A2130] transition-colors text-left"
        >
          <span className="w-8 h-8 rounded-full bg-[#1D4ED8]/15 dark:bg-[#3B82F6]/20 text-[#1D4ED8] dark:text-[#93C5FD] flex items-center justify-center text-xs font-semibold shrink-0">
            {(user?.displayName || 'Workspace').slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#0E1525] dark:text-[#F1F5F9] truncate">
              {user?.displayName || 'Local Workspace'}
            </p>
            <p className="text-[11px] text-[#556075] dark:text-[#8B97AD] truncate">
              {user?.email || 'Sign in for cloud sync'}
            </p>
          </div>
        </button>
      </div>
    </aside>
  );
};
