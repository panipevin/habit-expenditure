import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  EyeOff,
  Flame,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  Trophy,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { evaluateHabitStreak, getRankTitle } from '../utils/streaks';
import { buildAutomatedBudgetReport, formatINR } from '../utils/finance';
import { evaluateEveningCutoff } from '../utils/tasks';
import { formatHourLabel, formatShortDate } from '../utils/dates';
import { PWAInstallButton } from './PWAInstallButton';

export const DashboardView: React.FC = () => {
  const {
    todayISO,
    tasks,
    toggleTaskStatus,
    habits,
    toggleHabitToday,
    claimMilestoneReward,
    boards,
    calendarEvents,
    expenses,
    budgetLimits,
    widgets,
    toggleWidgetVisibility,
    moveWidget,
    toggleWidgetSize,
    notificationPrefs,
    setActiveSection,
    effectiveOnline,
    syncQueue,
  } = useWorkspace();

  const [customizing, setCustomizing] = useState(false);

  const pendingTasks = useMemo(() => tasks.filter((t) => t.status !== 'done'), [tasks]);
  const doneTodayCount = useMemo(
    () => tasks.filter((t) => t.status === 'done' && t.dueDate === todayISO).length,
    [tasks, todayISO]
  );

  const cutoffStatus = useMemo(
    () => evaluateEveningCutoff(tasks, new Date(), todayISO, notificationPrefs.eveningCutoffHour),
    [tasks, todayISO, notificationPrefs.eveningCutoffHour]
  );

  const habitSummaries = useMemo(
    () => habits.map((habit) => ({ habit, summary: evaluateHabitStreak(habit, todayISO) })),
    [habits, todayISO]
  );

  const totalStreakXP = useMemo(
    () => habitSummaries.reduce((sum, item) => sum + item.summary.earnedXP, 0),
    [habitSummaries]
  );
  const bestStreak = useMemo(
    () => habitSummaries.reduce((max, item) => Math.max(max, item.summary.currentStreak), 0),
    [habitSummaries]
  );
  const rankInfo = useMemo(() => getRankTitle(totalStreakXP), [totalStreakXP]);

  const budgetReport = useMemo(
    () => buildAutomatedBudgetReport(expenses, budgetLimits, todayISO),
    [expenses, budgetLimits, todayISO]
  );

  const upcomingEvents = useMemo(
    () =>
      [...calendarEvents]
        .filter((e) => e.date >= todayISO)
        .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))
        .slice(0, 4),
    [calendarEvents, todayISO]
  );

  const visibleWidgets = widgets.filter((w) => w.visible);

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#556075] dark:text-[#8B97AD]">
            {formatShortDate(todayISO)} · Evening planning cutoff {formatHourLabel(notificationPrefs.eveningCutoffHour)}
            {!effectiveOnline ? ` · Offline mode (${syncQueue.length} queued)` : ''}
          </p>
          <h1 className="mt-1 font-display text-2xl lg:text-3xl font-semibold tracking-tight text-[#0E1525] dark:text-[#F1F5F9]">
            Command Overview
          </h1>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <PWAInstallButton compact />
          <button
            type="button"
            onClick={() => setCustomizing((prev) => !prev)}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
              customizing
                ? 'bg-[#0E1525] text-white border-[#0E1525] dark:bg-[#F1F5F9] dark:text-[#0E1525] dark:border-[#F1F5F9]'
                : 'bg-white dark:bg-[#121722] text-[#0E1525] dark:text-[#F1F5F9] border-[#E2E6ED] dark:border-[#1F2737] hover:bg-[#F6F7F9] dark:hover:bg-[#1A2130]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {customizing ? 'Done Customizing' : 'Customize Widgets'}
          </button>
        </div>
      </div>

      {/* Top 4-Column Architectural KPI Strip */}
      <section aria-label="Workspace key metrics" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-5">
          <p className="text-xs font-medium text-[#556075] dark:text-[#8B97AD]">Pending Tasks</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#0E1525] dark:text-[#F1F5F9]">
            {pendingTasks.length}
          </p>
          <p className="mt-1 text-xs text-[#556075] dark:text-[#94A3B8]">
            {doneTodayCount} completed today · {cutoffStatus.tomorrowAssignedCount} lined up for tomorrow
          </p>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-5">
          <p className="text-xs font-medium text-[#556075] dark:text-[#8B97AD]">Active Peak Streak</p>
          <div className="mt-2 flex items-baseline gap-2">
            <Flame className="w-5 h-5 text-[#EA580C] dark:text-[#F59E0B] self-center" />
            <span className="font-mono text-2xl font-semibold tabular-nums text-[#0E1525] dark:text-[#F1F5F9]">
              {bestStreak}d
            </span>
          </div>
          <p className="mt-1 text-xs text-[#556075] dark:text-[#94A3B8]">
            {rankInfo.rank} · <span className="font-mono tabular-nums">{totalStreakXP} XP</span>
          </p>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-5">
          <p className="text-xs font-medium text-[#556075] dark:text-[#8B97AD]">Monthly Spend</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#0E1525] dark:text-[#F1F5F9]">
            {formatINR(budgetReport.totalSpent)}
          </p>
          <p className="mt-1 text-xs text-[#556075] dark:text-[#94A3B8]">
            <span className="font-mono tabular-nums">{budgetReport.utilizationPct}%</span> of {formatINR(budgetReport.totalBudget, false)} plan
          </p>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-5">
          <p className="text-xs font-medium text-[#556075] dark:text-[#8B97AD]">Team Boards</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#0E1525] dark:text-[#F1F5F9]">
            {boards.reduce((s, b) => s + b.items.filter((i) => i.status !== 'done').length, 0)}
          </p>
          <p className="mt-1 text-xs text-[#556075] dark:text-[#94A3B8]">
            Active cards across {boards.length} {boards.length === 1 ? 'board' : 'boards'}
          </p>
        </div>
      </section>

      {/* Customizable Widget Controls Panel */}
      {customizing && (
        <section
          aria-label="Widget layout customizer"
          className="rounded-xl bg-white dark:bg-[#121722] border border-[#1D4ED8]/40 dark:border-[#3B82F6]/40 p-5"
        >
          <div className="flex items-center justify-between gap-4 pb-3 border-b border-[#E2E6ED] dark:border-[#1F2737]">
            <div>
              <h2 className="font-display text-sm font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
                Dashboard Widget Layout
              </h2>
              <p className="text-xs text-[#556075] dark:text-[#94A3B8]">
                Reorder, resize, or hide widgets for quick daily accessibility. Changes save automatically.
              </p>
            </div>
          </div>

          <div className="mt-3 divide-y divide-[#E2E6ED] dark:divide-[#1F2737]">
            {widgets.map((widget, idx) => (
              <div key={widget.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0E1525] dark:text-[#F1F5F9] truncate">
                    {widget.title}
                  </p>
                  <p className="text-xs text-[#556075] dark:text-[#8B97AD]">
                    {widget.visible ? 'Visible' : 'Hidden'} · {widget.size === 'wide' ? 'Wide (2 columns)' : 'Compact (1 column)'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    aria-label={`Move ${widget.title} up`}
                    disabled={idx === 0}
                    onClick={() => moveWidget(widget.id, 'up')}
                    className="p-2 rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] text-[#556075] dark:text-[#94A3B8] hover:text-[#0E1525] dark:hover:text-[#F1F5F9] disabled:opacity-35"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${widget.title} down`}
                    disabled={idx === widgets.length - 1}
                    onClick={() => moveWidget(widget.id, 'down')}
                    className="p-2 rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] text-[#556075] dark:text-[#94A3B8] hover:text-[#0E1525] dark:hover:text-[#F1F5F9] disabled:opacity-35"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Toggle size for ${widget.title}`}
                    onClick={() => toggleWidgetSize(widget.id)}
                    className="p-2 rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] text-[#556075] dark:text-[#94A3B8] hover:text-[#0E1525] dark:hover:text-[#F1F5F9]"
                  >
                    {widget.size === 'wide' ? (
                      <Minimize2 className="w-3.5 h-3.5" />
                    ) : (
                      <Maximize2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={widget.visible ? `Hide ${widget.title}` : `Show ${widget.title}`}
                    onClick={() => toggleWidgetVisibility(widget.id)}
                    className="p-2 rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] text-[#556075] dark:text-[#94A3B8] hover:text-[#0E1525] dark:hover:text-[#F1F5F9]"
                  >
                    {widget.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Dynamic Widget Grid */}
      {visibleWidgets.length === 0 ? (
        <div className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-10 text-center">
          <p className="text-sm text-[#556075] dark:text-[#94A3B8]">
            All overview widgets are currently hidden.
          </p>
          <button
            type="button"
            onClick={() => setCustomizing(true)}
            className="mt-3 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-medium text-white"
          >
            Enable Widgets
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {visibleWidgets.map((widget) => {
            const spanClass = widget.size === 'wide' ? 'lg:col-span-2' : 'lg:col-span-1';

            if (widget.id === 'tasks') {
              return (
                <section
                  key={widget.id}
                  className={`${spanClass} rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-6 flex flex-col`}
                >
                  <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#E2E6ED] dark:border-[#1F2737]">
                    <div>
                      <h2 className="font-display text-base font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
                        Daily Tasks &amp; Evening Cutoff
                      </h2>
                      <p className="mt-0.5 text-xs text-[#556075] dark:text-[#94A3B8]">
                        Assign tomorrow&apos;s plan before {formatHourLabel(notificationPrefs.eveningCutoffHour)} for automated reminders
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSection('tasks')}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#1D4ED8] dark:text-[#60A5FA] hover:underline whitespace-nowrap shrink-0"
                    >
                      Open Tasks <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="divide-y divide-[#E2E6ED] dark:divide-[#1F2737] flex-1">
                    {pendingTasks.length === 0 ? (
                      <div className="py-8 text-center">
                        <p className="text-sm font-medium text-[#0E1525] dark:text-[#F1F5F9]">
                          No pending tasks yet
                        </p>
                        <p className="mt-1 text-xs text-[#556075] dark:text-[#8B97AD]">
                          Add your first daily task before {formatHourLabel(notificationPrefs.eveningCutoffHour)} for automated reminders.
                        </p>
                      </div>
                    ) : (
                      pendingTasks.slice(0, 4).map((task) => (
                        <div key={task.id} className="py-3 flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <button
                              type="button"
                              onClick={() => toggleTaskStatus(task.id)}
                              aria-label={`Mark "${task.title}" complete`}
                              className="mt-0.5 text-[#556075] hover:text-[#1D4ED8] dark:text-[#8B97AD] dark:hover:text-[#60A5FA] shrink-0"
                            >
                              {task.status === 'done' ? (
                                <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                              ) : (
                                <Circle className="w-4 h-4" />
                              )}
                            </button>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[#0E1525] dark:text-[#F1F5F9] truncate">
                                {task.title}
                              </p>
                              <p className="mt-0.5 text-xs text-[#556075] dark:text-[#8B97AD]">
                                {task.category} · {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} priority
                                {task.dueTime ? ` · Due ${task.dueTime}` : ''}
                                {task.assignedBeforeNight ? ' · Planned pre-cutoff' : ''}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              );
            }

            if (widget.id === 'habits') {
              return (
                <section
                  key={widget.id}
                  className={`${spanClass} rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-6 flex flex-col`}
                >
                  <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#E2E6ED] dark:border-[#1F2737]">
                    <h2 className="font-display text-base font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
                      Habit Streaks
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveSection('habits')}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#1D4ED8] dark:text-[#60A5FA] hover:underline whitespace-nowrap shrink-0"
                    >
                      All Streaks <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="divide-y divide-[#E2E6ED] dark:divide-[#1F2737] flex-1">
                    {habitSummaries.length === 0 ? (
                      <div className="py-8 text-center">
                        <p className="text-sm font-medium text-[#0E1525] dark:text-[#F1F5F9]">
                          No habits tracked yet
                        </p>
                        <p className="mt-1 text-xs text-[#556075] dark:text-[#8B97AD]">
                          Create a habit to start building streaks and unlocking milestone XP.
                        </p>
                      </div>
                    ) : (
                      habitSummaries.slice(0, 4).map(({ habit, summary }) => (
                        <div key={habit.id} className="py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#0E1525] dark:text-[#F1F5F9] truncate">
                              {habit.name}
                            </p>
                            <p className="mt-0.5 text-xs text-[#556075] dark:text-[#8B97AD]">
                              {summary.status === 'paused'
                                ? 'Paused (protected)'
                                : summary.status === 'at_risk'
                                ? 'Check in today to keep streak'
                                : summary.nextMilestone
                                ? `${summary.nextMilestone.days - summary.currentStreak}d to ${summary.nextMilestone.title}`
                                : 'Centurion Flame achieved'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold tabular-nums text-[#EA580C] dark:text-[#F59E0B]">
                              <Flame className="w-3.5 h-3.5 fill-current" />
                              {summary.currentStreak}
                            </span>
                            {summary.unclaimedMilestones.length > 0 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  claimMilestoneReward(habit.id, summary.unclaimedMilestones[0].days)
                                }
                                className="inline-flex items-center gap-1 rounded-md bg-[#D97706] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#B45309] transition-colors whitespace-nowrap"
                              >
                                <Trophy className="w-3 h-3" />
                                Claim
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={habit.isPaused}
                                onClick={() => toggleHabitToday(habit.id)}
                                aria-label={
                                  summary.completedToday
                                    ? `Undo check-in for ${habit.name}`
                                    : `Complete ${habit.name} today`
                                }
                                className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors disabled:opacity-40 ${
                                  summary.completedToday
                                    ? 'bg-[#16A34A] border-[#16A34A] text-white'
                                    : 'border-[#E2E6ED] dark:border-[#1F2737] text-[#556075] hover:border-[#1D4ED8]'
                                }`}
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              );
            }

            if (widget.id === 'calendar') {
              return (
                <section
                  key={widget.id}
                  className={`${spanClass} rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-6 flex flex-col`}
                >
                  <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#E2E6ED] dark:border-[#1F2737]">
                    <h2 className="font-display text-base font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
                      Calendar Agenda
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveSection('calendar')}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#1D4ED8] dark:text-[#60A5FA] hover:underline whitespace-nowrap shrink-0"
                    >
                      Full Calendar <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="divide-y divide-[#E2E6ED] dark:divide-[#1F2737] flex-1">
                    {upcomingEvents.length === 0 ? (
                      <div className="py-8 text-center">
                        <p className="text-sm font-medium text-[#0E1525] dark:text-[#F1F5F9]">
                          No upcoming events
                        </p>
                        <p className="mt-1 text-xs text-[#556075] dark:text-[#8B97AD]">
                          Schedule team meetings or deadlines in the Calendar.
                        </p>
                      </div>
                    ) : (
                      upcomingEvents.map((ev) => (
                        <div key={ev.id} className="py-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#0E1525] dark:text-[#F1F5F9] truncate">
                              {ev.title}
                            </p>
                            <p className="mt-0.5 text-xs text-[#556075] dark:text-[#8B97AD]">
                              {formatShortDate(ev.date)} · {ev.startTime} · {ev.eventType === 'meeting' ? 'Team meeting' : ev.eventType === 'deadline' ? 'Deadline' : 'Reminder'}
                              {ev.urgent ? ' · Urgent' : ''}
                            </p>
                          </div>
                          <CalendarDays className="w-4 h-4 text-[#556075] dark:text-[#8B97AD] shrink-0 mt-0.5" />
                        </div>
                      ))
                    )}
                  </div>
                </section>
              );
            }

            if (widget.id === 'boards') {
              const activeBoard = boards[0];
              return (
                <section
                  key={widget.id}
                  className={`${spanClass} rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-6 flex flex-col`}
                >
                  <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#E2E6ED] dark:border-[#1F2737]">
                    <div>
                      <h2 className="font-display text-base font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
                        Shared Team Boards Pulse
                      </h2>
                      <p className="mt-0.5 text-xs text-[#556075] dark:text-[#94A3B8]">
                        {activeBoard
                          ? `${activeBoard.name} · ${activeBoard.members.length} ${activeBoard.members.length === 1 ? 'member' : 'members'}`
                          : 'No shared boards created yet'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSection('boards')}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#1D4ED8] dark:text-[#60A5FA] hover:underline whitespace-nowrap shrink-0"
                    >
                      Open Boards <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="divide-y divide-[#E2E6ED] dark:divide-[#1F2737]">
                    {!activeBoard || activeBoard.items.length === 0 ? (
                      <div className="py-8 text-center">
                        <p className="text-sm font-medium text-[#0E1525] dark:text-[#F1F5F9]">
                          {activeBoard ? 'No cards on this board yet' : 'Start your first shared board'}
                        </p>
                        <p className="mt-1 text-xs text-[#556075] dark:text-[#8B97AD]">
                          Create a project board to track status updates and collaborate in real time.
                        </p>
                      </div>
                    ) : (
                      activeBoard.items.slice(0, 3).map((item) => (
                        <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#0E1525] dark:text-[#F1F5F9] truncate">
                              {item.title}
                            </p>
                            <p className="mt-0.5 text-xs text-[#556075] dark:text-[#8B97AD]">
                              {item.assigneeName} · {item.status.replace('_', ' ')} · Due {formatShortDate(item.dueDate)}
                            </p>
                          </div>
                          {item.assigneeAvatar ? (
                            <img
                              src={item.assigneeAvatar}
                              alt={item.assigneeName}
                              referrerPolicy="no-referrer"
                              className="w-7 h-7 rounded-full object-cover shrink-0 border border-[#E2E6ED] dark:border-[#1F2737]"
                            />
                          ) : (
                            <span className="w-7 h-7 rounded-full bg-[#1D4ED8]/15 text-[#1D4ED8] dark:text-[#93C5FD] flex items-center justify-center text-[11px] font-semibold shrink-0">
                              {item.assigneeName.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </section>
              );
            }

            if (widget.id === 'expenses') {
              return (
                <section
                  key={widget.id}
                  className={`${spanClass} rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-6 flex flex-col`}
                >
                  <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#E2E6ED] dark:border-[#1F2737]">
                    <h2 className="font-display text-base font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
                      Personal Budget
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveSection('expenses')}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#1D4ED8] dark:text-[#60A5FA] hover:underline whitespace-nowrap shrink-0"
                    >
                      Expenses &amp; CSV <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-xl font-semibold tabular-nums text-[#0E1525] dark:text-[#F1F5F9]">
                        {formatINR(budgetReport.remainingBudget)}
                      </span>
                      <span className="text-xs text-[#556075] dark:text-[#8B97AD]">remaining</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#E2E6ED] dark:bg-[#1F2737] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          budgetReport.utilizationPct > 100
                            ? 'bg-[#DC2626]'
                            : budgetReport.utilizationPct >= 80
                            ? 'bg-[#D97706]'
                            : 'bg-[#1D4ED8] dark:bg-[#3B82F6]'
                        }`}
                        style={{ width: `${Math.min(100, budgetReport.utilizationPct)}%` }}
                      />
                    </div>
                    <p className="text-xs text-[#556075] dark:text-[#94A3B8] leading-relaxed">
                      {budgetReport.insights[0] || 'Tracking within monthly budget.'}
                    </p>
                  </div>
                </section>
              );
            }

            return (
              <section
                key={widget.id}
                className={`${spanClass} rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-6 flex flex-col`}
              >
                <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#E2E6ED] dark:border-[#1F2737]">
                  <h2 className="font-display text-base font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
                    14-Day Momentum
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveSection('analytics')}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#1D4ED8] dark:text-[#60A5FA] hover:underline whitespace-nowrap shrink-0"
                  >
                    Analytics <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#556075] dark:text-[#94A3B8]">Task completion rate</span>
                    <span className="font-mono font-semibold tabular-nums text-[#0E1525] dark:text-[#F1F5F9]">
                      {tasks.length > 0
                        ? Math.round((tasks.filter((t) => t.status === 'done').length / tasks.length) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#556075] dark:text-[#94A3B8]">Habits completed today</span>
                    <span className="font-mono font-semibold tabular-nums text-[#0E1525] dark:text-[#F1F5F9]">
                      {habitSummaries.filter((h) => h.summary.completedToday).length}/{habits.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#556075] dark:text-[#94A3B8]">Evening cutoff readiness</span>
                    <span className="inline-flex items-center gap-1 font-mono font-semibold tabular-nums text-[#16A34A] dark:text-[#4ADE80]">
                      <Clock className="w-3.5 h-3.5" />
                      {cutoffStatus.tomorrowAssignedCount} queued
                    </span>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
