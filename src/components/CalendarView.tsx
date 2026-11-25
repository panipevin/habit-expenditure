import React, { useMemo, useState } from 'react';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import type { CalendarEventType } from '../types';
import { formatShortDate, getMonthCalendarDays, parseDateISO } from '../utils/dates';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const CalendarView: React.FC = () => {
  const {
    todayISO,
    calendarEvents,
    tasks,
    addCalendarEvent,
    deleteCalendarEvent,
    isReadOnlyView,
    viewingAccountName,
  } = useWorkspace();

  const initialDate = parseDateISO(todayISO);
  const [year, setYear] = useState(initialDate.getFullYear());
  const [monthIndex, setMonthIndex] = useState(initialDate.getMonth());
  const [selectedISO, setSelectedISO] = useState(todayISO);

  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState<CalendarEventType>('meeting');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('10:45');
  const [urgent, setUrgent] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(15);
  const [participantsText, setParticipantsText] = useState('');

  const monthCells = useMemo(() => getMonthCalendarDays(year, monthIndex), [year, monthIndex]);
  const monthLabel = useMemo(
    () => new Date(year, monthIndex, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    [year, monthIndex]
  );

  // Merge team meetings, calendar deadlines, and individual tasks due on each day
  const itemsByDate = useMemo(() => {
    const map = new Map<string, { count: number; hasUrgent: boolean }>();
    for (const ev of calendarEvents) {
      const cur = map.get(ev.date) || { count: 0, hasUrgent: false };
      map.set(ev.date, { count: cur.count + 1, hasUrgent: cur.hasUrgent || ev.urgent });
    }
    for (const t of tasks) {
      if (t.status === 'done') continue;
      const cur = map.get(t.dueDate) || { count: 0, hasUrgent: false };
      map.set(t.dueDate, {
        count: cur.count + 1,
        hasUrgent: cur.hasUrgent || t.priority === 'urgent',
      });
    }
    return map;
  }, [calendarEvents, tasks]);

  const selectedDayEvents = useMemo(
    () =>
      calendarEvents
        .filter((e) => e.date === selectedISO)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [calendarEvents, selectedISO]
  );

  const selectedDayTasks = useMemo(
    () => tasks.filter((t) => t.dueDate === selectedISO),
    [tasks, selectedISO]
  );

  const prevMonth = () => {
    if (monthIndex === 0) {
      setMonthIndex(11);
      setYear((y) => y - 1);
    } else {
      setMonthIndex((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (monthIndex === 11) {
      setMonthIndex(0);
      setYear((y) => y + 1);
    } else {
      setMonthIndex((m) => m + 1);
    }
  };

  const handleSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addCalendarEvent({
      title,
      eventType,
      date: selectedISO,
      startTime,
      endTime: eventType === 'meeting' ? endTime : undefined,
      urgent,
      reminderMinutes,
      participants: participantsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
    setTitle('');
    setFormOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#556075] dark:text-[#8B97AD]">
            Integrated schedule · Syncs team meetings, personal deadlines &amp; automated reminders
          </p>
          <h1 className="mt-1 font-display text-2xl lg:text-3xl font-semibold tracking-tight text-[#0E1525] dark:text-[#F1F5F9]">
            {isReadOnlyView && viewingAccountName ? `${viewingAccountName}'s Calendar` : 'Calendar'}
          </h1>
        </div>

        {!isReadOnlyView && (
          <button
            type="button"
            onClick={() => setFormOpen((prev) => !prev)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] dark:bg-[#3B82F6] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#1E40AF] dark:hover:bg-[#2563EB] whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Schedule Meeting / Deadline
          </button>
        )}
      </div>

      {formOpen && !isReadOnlyView && (
        <form
          onSubmit={handleSchedule}
          className="rounded-xl bg-white dark:bg-[#121722] border border-[#1D4ED8]/40 p-6 space-y-4"
        >
          <h2 className="font-display text-base font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
            New Entry on {formatShortDate(selectedISO)}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="cal-title" className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8] mb-1">
                Title
              </label>
              <input
                id="cal-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Architecture Review Sync"
                className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3.5 py-2 text-sm text-[#0E1525] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label htmlFor="cal-type" className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8] mb-1">
                Type
              </label>
              <select
                id="cal-type"
                value={eventType}
                onChange={(e) => setEventType(e.target.value as CalendarEventType)}
                className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3 py-2 text-sm text-[#0E1525] dark:text-[#F1F5F9]"
              >
                <option value="meeting">Team Meeting</option>
                <option value="deadline">Individual Deadline</option>
                <option value="reminder">Automated Reminder</option>
              </select>
            </div>
            <div>
              <label htmlFor="cal-start" className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8] mb-1">
                Start time
              </label>
              <input
                id="cal-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3 py-2 text-sm font-mono text-[#0E1525] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label htmlFor="cal-reminder" className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8] mb-1">
                Lead-time alert (minutes)
              </label>
              <select
                id="cal-reminder"
                value={reminderMinutes}
                onChange={(e) => setReminderMinutes(Number(e.target.value))}
                className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3 py-2 text-sm font-mono text-[#0E1525] dark:text-[#F1F5F9]"
              >
                <option value={10}>10 min before</option>
                <option value={15}>15 min before</option>
                <option value={30}>30 min before</option>
                <option value={60}>60 min before</option>
              </select>
            </div>
            <div>
              <label htmlFor="cal-participants" className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8] mb-1">
                Participants
              </label>
              <input
                id="cal-participants"
                type="text"
                value={participantsText}
                onChange={(e) => setParticipantsText(e.target.value)}
                placeholder="Optional: comma-separated names"
                className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3 py-2 text-sm text-[#0E1525] dark:text-[#F1F5F9]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="inline-flex items-center gap-2 text-xs text-[#0E1525] dark:text-[#E2E8F0] cursor-pointer">
              <input
                type="checkbox"
                checked={urgent}
                onChange={(e) => setUrgent(e.target.checked)}
                className="rounded border-[#CBD5E1] text-[#1D4ED8]"
              />
              Mark as urgent deadline (triggers real-time push alert)
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] px-4 py-2 text-xs font-medium text-[#556075]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#0E1525] dark:bg-[#F1F5F9] px-4 py-2 text-xs font-medium text-white dark:text-[#0E1525]"
              >
                Save to Calendar
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Monthly Calendar Grid */}
        <section className="lg:col-span-8 rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
              {monthLabel}
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Previous month"
                onClick={prevMonth}
                className="p-2 rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] text-[#556075] hover:text-[#0E1525] dark:hover:text-[#F1F5F9]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const t = parseDateISO(todayISO);
                  setYear(t.getFullYear());
                  setMonthIndex(t.getMonth());
                  setSelectedISO(todayISO);
                }}
                className="px-3 py-1.5 rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] text-xs font-medium text-[#0E1525] dark:text-[#F1F5F9]"
              >
                Today
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={nextMonth}
                className="p-2 rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] text-[#556075] hover:text-[#0E1525] dark:hover:text-[#F1F5F9]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center text-xs font-medium text-[#556075] dark:text-[#8B97AD] pb-2">
            {WEEKDAYS.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {monthCells.map((cell) => {
              const meta = itemsByDate.get(cell.iso);
              const isSelected = cell.iso === selectedISO;
              const isToday = cell.iso === todayISO;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => setSelectedISO(cell.iso)}
                  aria-label={`Select ${cell.iso}${meta ? `, ${meta.count} items` : ''}`}
                  className={`h-14 sm:h-16 rounded-lg border p-2 flex flex-col items-start justify-between text-left transition-colors ${
                    isSelected
                      ? 'border-[#1D4ED8] bg-[#1D4ED8]/10 dark:border-[#3B82F6] dark:bg-[#3B82F6]/15'
                      : isToday
                      ? 'border-[#0E1525] dark:border-[#94A3B8] bg-[#F6F7F9] dark:bg-[#1A2130]'
                      : 'border-[#E2E6ED]/80 dark:border-[#1F2737] hover:bg-[#F6F7F9] dark:hover:bg-[#1A2130]'
                  } ${cell.inMonth ? '' : 'opacity-40'}`}
                >
                  <span className="font-mono text-xs font-semibold tabular-nums text-[#0E1525] dark:text-[#F1F5F9]">
                    {cell.dayNum}
                  </span>
                  {meta && meta.count > 0 && (
                    <span
                      className={`font-mono text-[10px] tabular-nums ${
                        meta.hasUrgent
                          ? 'font-semibold text-[#DC2626] dark:text-[#F87171]'
                          : 'text-[#1D4ED8] dark:text-[#60A5FA]'
                      }`}
                    >
                      {meta.count} {meta.count === 1 ? 'item' : 'items'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Selected Day Agenda */}
        <section className="lg:col-span-4 rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-5 flex flex-col">
          <div className="pb-4 border-b border-[#E2E6ED] dark:border-[#1F2737]">
            <p className="text-xs text-[#556075] dark:text-[#8B97AD]">Agenda for</p>
            <h2 className="font-display text-lg font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
              {formatShortDate(selectedISO)}
            </h2>
          </div>

          <div className="divide-y divide-[#E2E6ED] dark:divide-[#1F2737] flex-1">
            {selectedDayEvents.length === 0 && selectedDayTasks.length === 0 ? (
              <p className="py-10 text-center text-xs text-[#556075] dark:text-[#8B97AD]">
                Clear schedule on {formatShortDate(selectedISO)}.
              </p>
            ) : (
              <>
                {selectedDayEvents.map((ev) => (
                  <div key={ev.id} className="py-3.5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#0E1525] dark:text-[#F1F5F9]">
                        {ev.title}
                      </p>
                      <p className="mt-0.5 text-xs text-[#556075] dark:text-[#8B97AD]">
                        <span className="font-mono tabular-nums">
                          {ev.startTime}
                          {ev.endTime ? `–${ev.endTime}` : ''}
                        </span>{' '}
                        · {ev.eventType === 'meeting' ? 'Team meeting' : ev.eventType === 'deadline' ? 'Deadline' : 'Reminder'}
                        {ev.urgent ? ' · Urgent' : ''}
                      </p>
                      <p className="mt-1 text-[11px] text-[#556075] dark:text-[#94A3B8] flex items-center gap-1">
                        <Bell className="w-3 h-3" /> {ev.reminderMinutes}m alert · {ev.participants.join(', ')}
                      </p>
                    </div>
                    {!isReadOnlyView && (
                      <button
                        type="button"
                        aria-label={`Remove "${ev.title}"`}
                        onClick={() => deleteCalendarEvent(ev.id)}
                        className="p-1.5 text-[#556075] hover:text-[#DC2626]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}

                {selectedDayTasks.map((t) => (
                  <div key={t.id} className="py-3.5">
                    <p className="text-sm font-medium text-[#0E1525] dark:text-[#F1F5F9]">
                      {t.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[#556075] dark:text-[#8B97AD]">
                      Task deadline{t.dueTime ? ` · ${t.dueTime}` : ''} · {t.category} · {t.status === 'done' ? 'Completed' : 'Pending'}
                    </p>
                  </div>
                ))}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
