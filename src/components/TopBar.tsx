import React, { useState } from 'react';
import { Bell, Lock, Moon, Search, Sun, X } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import type { AppSection } from '../types';

const SECTION_LABELS: Record<AppSection, string> = {
  dashboard: 'Overview',
  tasks: 'Daily Tasks',
  habits: 'Habit Streaks',
  family: 'Family & Sharing',
  calendar: 'Calendar',
  expenses: 'Expenses',
  analytics: 'Analytics',
  settings: 'Security & Sync',
};

export const TopBar: React.FC = () => {
  const {
    activeSection,
    setActiveSection,
    globalSearch,
    setGlobalSearch,
    theme,
    toggleTheme,
    notifications,
    markAllNotificationsRead,
    vaultLockEnabled,
    lockVault,
    connectedAccounts,
    viewingAccountId,
    setViewingAccountId,
  } = useWorkspace();

  const [notifOpen, setNotifOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleSearchChange = (value: string) => {
    setGlobalSearch(value);
    if (value.trim() && activeSection !== 'tasks') {
      setActiveSection('tasks');
    }
  };

  return (
    <header className="sticky top-0 z-30 h-13 lg:h-16 bg-white/95 dark:bg-[#121722]/95 backdrop-blur-md border-b border-[#E2E6ED] dark:border-[#1F2737] px-4 lg:px-8 flex items-center justify-between gap-3 lg:gap-6">
      {/* Zone 1: Brand on Mobile / Section Breadcrumb on Desktop */}
      <div className="flex items-center gap-2 min-w-0 shrink-0">
        <span className="lg:hidden flex items-center justify-center w-6 h-6 rounded-md bg-[#0E1525] dark:bg-[#1D4ED8] text-white font-display font-bold text-xs shrink-0">
          C
        </span>
        <span className="hidden lg:inline text-xs font-medium text-[#556075] dark:text-[#8B97AD] whitespace-nowrap">
          Workspace /
        </span>
        <span className="font-display text-sm lg:text-base font-semibold text-[#0E1525] dark:text-[#F1F5F9] whitespace-nowrap truncate">
          {SECTION_LABELS[activeSection]}
        </span>
      </div>

      {/* Zone 2: Pending Task Search Bar */}
      <div className="flex-1 max-w-md">
        <label htmlFor="pending-task-search" className="sr-only">
          Search pending tasks
        </label>
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-[#556075] dark:text-[#8B97AD] absolute left-3 pointer-events-none" />
          <input
            id="pending-task-search"
            type="search"
            value={globalSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search pending tasks..."
            className="w-full h-9 lg:h-10 pl-9 pr-8 rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] text-xs lg:text-sm text-[#0E1525] dark:text-[#F1F5F9] placeholder:text-[#6B768B] dark:placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8] transition-shadow"
          />
          {globalSearch && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setGlobalSearch('')}
              className="absolute right-2 p-1 text-[#556075] hover:text-[#0E1525] dark:hover:text-[#F1F5F9]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Zone 3: Quick Account Switcher, Theme, Notifications, & Lock Action */}
      <div className="flex items-center gap-1.5 shrink-0 relative">
        {connectedAccounts.length > 0 && (
          <select
            aria-label="Switch viewed account"
            value={viewingAccountId || '__self__'}
            onChange={(e) =>
              setViewingAccountId(e.target.value === '__self__' ? null : e.target.value)
            }
            className="h-9 max-w-[140px] sm:max-w-[190px] rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-2 text-xs font-medium text-[#0E1525] dark:text-[#F1F5F9]"
          >
            <option value="__self__">My Account</option>
            {connectedAccounts.map((acc) => (
              <option key={acc.ownerId} value={acc.ownerId}>
                {acc.displayName} (View Only)
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg text-[#556075] dark:text-[#94A3B8] hover:bg-[#F6F7F9] dark:hover:bg-[#1A2130] hover:text-[#0E1525] dark:hover:text-[#F1F5F9] transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {vaultLockEnabled && (
          <button
            type="button"
            onClick={lockVault}
            aria-label="Lock privacy vault"
            className="lg:hidden min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg text-[#556075] dark:text-[#94A3B8] hover:bg-[#F6F7F9] dark:hover:bg-[#1A2130]"
          >
            <Lock className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={() => setNotifOpen((prev) => !prev)}
          aria-label={`Open notifications (${unreadCount} unread)`}
          aria-expanded={notifOpen}
          className="relative min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg text-[#556075] dark:text-[#94A3B8] hover:bg-[#F6F7F9] dark:hover:bg-[#1A2130] hover:text-[#0E1525] dark:hover:text-[#F1F5F9] transition-colors"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[#1D4ED8] dark:bg-[#3B82F6] text-[10px] font-mono font-semibold text-white flex items-center justify-center tabular-nums">
              {unreadCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <div
            role="region"
            aria-label="Notification center"
            className="absolute right-0 top-12 w-80 sm:w-96 rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] shadow-lg overflow-hidden z-50"
          >
            <div className="px-4 py-3 border-b border-[#E2E6ED] dark:border-[#1F2737] flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
                Notifications
              </h2>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="text-xs font-medium text-[#1D4ED8] dark:text-[#60A5FA] hover:underline"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Close notifications"
                  onClick={() => setNotifOpen(false)}
                  className="text-[#556075] hover:text-[#0E1525] dark:hover:text-[#F1F5F9]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-[#E2E6ED] dark:divide-[#1F2737]">
              {notifications.length === 0 ? (
                <p className="p-6 text-center text-xs text-[#556075] dark:text-[#8B97AD]">
                  No notifications right now.
                </p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 text-left ${
                      n.read ? 'opacity-75' : 'bg-[#F6F7F9]/70 dark:bg-[#1A2130]/50'
                    }`}
                  >
                    <p className="text-xs font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[#556075] dark:text-[#94A3B8] leading-relaxed">
                      {n.message}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
