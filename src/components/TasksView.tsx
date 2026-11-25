import React, { useMemo, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import type { TaskPriority, TaskStatus } from '../types';
import { addDaysISO, formatHourLabel, formatShortDate } from '../utils/dates';
import { evaluateEveningCutoff, filterAndSortTasks } from '../utils/tasks';

const CATEGORIES = ['Engineering', 'Product', 'Finance', 'Security', 'Operations', 'Personal'];

export const TasksView: React.FC = () => {
  const {
    todayISO,
    tasks,
    addTask,
    toggleTaskStatus,
    updateTaskStatus,
    deleteTask,
    globalSearch,
    setGlobalSearch,
    notificationPrefs,
    isReadOnlyView,
    viewingAccountName,
  } = useWorkspace();

  const [statusFilter, setStatusFilter] = useState<'pending' | 'all' | 'in_progress' | 'done'>('pending');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [composerOpen, setComposerOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('Product');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState(todayISO);
  const [dueTime, setDueTime] = useState('16:00');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const cutoff = useMemo(
    () => evaluateEveningCutoff(tasks, new Date(), todayISO, notificationPrefs.eveningCutoffHour),
    [tasks, todayISO, notificationPrefs.eveningCutoffHour]
  );

  const filteredTasks = useMemo(
    () =>
      filterAndSortTasks(tasks, {
        searchQuery: globalSearch,
        status: statusFilter,
        priority: priorityFilter,
      }),
    [tasks, globalSearch, statusFilter, priorityFilter]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Enter a task title before saving.');
      return;
    }
    setFormError(null);
    addTask({
      title,
      notes,
      category,
      priority,
      dueDate,
      dueTime,
      reminderEnabled,
    });
    setTitle('');
    setNotes('');
    setComposerOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#556075] dark:text-[#8B97AD]">
            Daily schedule · Evening assignment cutoff {formatHourLabel(notificationPrefs.eveningCutoffHour)}
          </p>
          <h1 className="mt-1 font-display text-2xl lg:text-3xl font-semibold tracking-tight text-[#0E1525] dark:text-[#F1F5F9]">
            {isReadOnlyView && viewingAccountName ? `${viewingAccountName}'s Daily Tasks` : 'Daily Tasks'}
          </h1>
        </div>

        {!isReadOnlyView && (
          <button
            type="button"
            onClick={() => setComposerOpen((prev) => !prev)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] dark:bg-[#3B82F6] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#1E40AF] dark:hover:bg-[#2563EB] transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            {composerOpen ? 'Close Composer' : 'New Daily Task'}
          </button>
        )}
      </div>

      {/* Evening Cutoff Planning Strip */}
      <section
        aria-label="Evening task assignment schedule"
        className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-[#1D4ED8] dark:text-[#60A5FA] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
              Pre-Night Assignment Window ({formatHourLabel(notificationPrefs.eveningCutoffHour)} Cutoff)
            </p>
            <p className="mt-0.5 text-xs text-[#556075] dark:text-[#94A3B8]">
              {cutoff.tomorrowAssignedCount} task{cutoff.tomorrowAssignedCount === 1 ? '' : 's'} assigned for tomorrow ({formatShortDate(cutoff.tomorrowISO)}). Assign tasks before nightfall to trigger automated morning reminders.
            </p>
          </div>
        </div>
        {!isReadOnlyView && (
          <button
            type="button"
            onClick={() => {
              setDueDate(addDaysISO(todayISO, 1));
              setComposerOpen(true);
            }}
            className="rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] px-3.5 py-2 text-xs font-medium text-[#0E1525] dark:text-[#F1F5F9] hover:bg-[#F6F7F9] dark:hover:bg-[#1A2130] transition-colors whitespace-nowrap shrink-0"
          >
            Plan Tomorrow
          </button>
        )}
      </section>

      {/* Task Composer */}
      {composerOpen && !isReadOnlyView && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl bg-white dark:bg-[#121722] border border-[#1D4ED8]/40 dark:border-[#3B82F6]/40 p-6 space-y-4"
        >
          <h2 className="font-display text-base font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
            Schedule Daily Task
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="task-title" className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8] mb-1">
                Task title
              </label>
              <input
                id="task-title"
                type="text"
                maxLength={160}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Finalize mobile push reminder templates"
                className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3.5 py-2.5 text-sm text-[#0E1525] dark:text-[#F1F5F9] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              />
            </div>

            <div>
              <label htmlFor="task-category" className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8] mb-1">
                Category
              </label>
              <select
                id="task-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3 py-2.5 text-sm text-[#0E1525] dark:text-[#F1F5F9]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="task-priority" className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8] mb-1">
                Priority
              </label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3 py-2.5 text-sm text-[#0E1525] dark:text-[#F1F5F9]"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent (Push Alert)</option>
              </select>
            </div>

            <div>
              <label htmlFor="task-due-date" className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8] mb-1">
                Scheduled date
              </label>
              <input
                id="task-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3 py-2.5 text-sm text-[#0E1525] dark:text-[#F1F5F9] font-mono"
              />
            </div>

            <div>
              <label htmlFor="task-due-time" className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8] mb-1">
                Reminder time
              </label>
              <input
                id="task-due-time"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3 py-2.5 text-sm text-[#0E1525] dark:text-[#F1F5F9] font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="task-notes" className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8] mb-1">
                Notes (optional)
              </label>
              <input
                id="task-notes"
                type="text"
                maxLength={500}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Context, links, or checklist details"
                className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3.5 py-2.5 text-sm text-[#0E1525] dark:text-[#F1F5F9]"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <label className="inline-flex items-center gap-2 text-xs text-[#0E1525] dark:text-[#E2E8F0] cursor-pointer">
              <input
                type="checkbox"
                checked={reminderEnabled}
                onChange={(e) => setReminderEnabled(e.target.checked)}
                className="rounded border-[#CBD5E1] text-[#1D4ED8] focus:ring-[#1D4ED8]"
              />
              Enable automated schedule reminder notification
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] px-4 py-2 text-xs font-medium text-[#556075] dark:text-[#94A3B8]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#0E1525] dark:bg-[#F1F5F9] px-4 py-2 text-xs font-medium text-white dark:text-[#0E1525] hover:opacity-90"
              >
                Save Task
              </button>
            </div>
          </div>

          {formError && (
            <p className="text-xs font-medium text-[#DC2626] dark:text-[#F87171]">{formError}</p>
          )}
        </form>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#E9EDF3] dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] self-start">
          {(
            [
              { id: 'pending', label: 'Pending' },
              { id: 'in_progress', label: 'In Progress' },
              { id: 'done', label: 'Completed' },
              { id: 'all', label: 'All' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === tab.id
                  ? 'bg-white dark:bg-[#1F2737] text-[#0E1525] dark:text-[#F1F5F9] shadow-2xs'
                  : 'text-[#556075] dark:text-[#8B97AD] hover:text-[#0E1525] dark:hover:text-[#F1F5F9]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 md:w-56">
            <Search className="w-3.5 h-3.5 text-[#556075] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="Filter pending tasks by keyword"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Filter tasks..."
              className="w-full h-9 pl-8 pr-3 rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-white dark:bg-[#121722] text-xs text-[#0E1525] dark:text-[#F1F5F9]"
            />
          </div>

          <select
            aria-label="Filter tasks by priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | 'all')}
            className="h-9 rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-white dark:bg-[#121722] px-3 text-xs text-[#0E1525] dark:text-[#F1F5F9]"
          >
            <option value="all">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Task List */}
      <section className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] divide-y divide-[#E2E6ED] dark:divide-[#1F2737]">
        {filteredTasks.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-[#0E1525] dark:text-[#F1F5F9]">
              No matching tasks found
            </p>
            <p className="mt-1 text-xs text-[#556075] dark:text-[#8B97AD]">
              {globalSearch
                ? `No tasks match "${globalSearch}". Try clearing the search filter.`
                : 'Schedule a task to start your daily plan.'}
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isDone = task.status === 'done';
            return (
              <div
                key={task.id}
                className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F6F7F9]/60 dark:hover:bg-[#1A2130]/40 transition-colors"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  {isReadOnlyView ? (
                    <span className="mt-0.5 text-[#556075] dark:text-[#8B97AD] shrink-0">
                      {isDone ? (
                        <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleTaskStatus(task.id)}
                      aria-label={isDone ? `Reopen "${task.title}"` : `Complete "${task.title}"`}
                      className="mt-0.5 text-[#556075] hover:text-[#1D4ED8] dark:text-[#8B97AD] dark:hover:text-[#60A5FA] shrink-0"
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>
                  )}

                  <div className="min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        isDone
                          ? 'line-through text-[#6B768B] dark:text-[#64748B]'
                          : 'text-[#0E1525] dark:text-[#F1F5F9]'
                      }`}
                    >
                      {task.title}
                    </p>
                    {task.notes && (
                      <p className="mt-0.5 text-xs text-[#556075] dark:text-[#94A3B8] line-clamp-1">
                        {task.notes}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#556075] dark:text-[#8B97AD]">
                      <span>{task.category}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          task.priority === 'urgent'
                            ? 'font-semibold text-[#DC2626] dark:text-[#F87171]'
                            : task.priority === 'high'
                            ? 'font-medium text-[#D97706] dark:text-[#FBBF24]'
                            : ''
                        }
                      >
                        {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} priority
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {formatShortDate(task.dueDate)}
                        {task.dueTime ? ` ${task.dueTime}` : ''}
                      </span>
                      {task.assignedBeforeNight && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Assigned pre-cutoff</span>
                        </>
                      )}
                      {task.reminderEnabled && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1">
                            <Bell className="w-3 h-3" /> Reminder on
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {isReadOnlyView ? (
                    <span className="rounded-md border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-2.5 py-1 text-xs font-medium text-[#556075] dark:text-[#94A3B8]">
                      {task.status === 'done'
                        ? 'Done'
                        : task.status === 'in_progress'
                        ? 'In Progress'
                        : 'To Do'}
                    </span>
                  ) : (
                    <>
                      <select
                        aria-label={`Change status for "${task.title}"`}
                        value={task.status}
                        onChange={(e) => updateTaskStatus(task.id, e.target.value as TaskStatus)}
                        className="h-8 rounded-md border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-2 text-xs text-[#0E1525] dark:text-[#F1F5F9]"
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => deleteTask(task.id)}
                        aria-label={`Delete task "${task.title}"`}
                        className="p-2 rounded-md text-[#556075] hover:text-[#DC2626] hover:bg-[#FEE2E2]/50 dark:hover:bg-[#7F1D1D]/30 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
};
