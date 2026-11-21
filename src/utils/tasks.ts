import type { DailyTask, TaskPriority, TaskStatus } from '../types';
import { addDaysISO } from './dates';

export interface TaskFilterOptions {
  searchQuery?: string;
  status?: TaskStatus | 'all' | 'pending';
  priority?: TaskPriority | 'all';
  category?: string;
}

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function filterAndSortTasks(tasks: DailyTask[], options: TaskFilterOptions): DailyTask[] {
  const q = (options.searchQuery || '').trim().toLowerCase();

  return tasks
    .filter((task) => {
      if (options.status === 'pending' && task.status === 'done') return false;
      if (options.status && options.status !== 'all' && options.status !== 'pending' && task.status !== options.status) {
        return false;
      }
      if (options.priority && options.priority !== 'all' && task.priority !== options.priority) {
        return false;
      }
      if (options.category && options.category !== 'all' && task.category !== options.category) {
        return false;
      }
      if (q) {
        const hay = `${task.title} ${task.category} ${task.notes || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Done items sink to the bottom
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (a.status !== 'done' && b.status === 'done') return -1;
      // Earlier due dates first
      const dateCmp = a.dueDate.localeCompare(b.dueDate);
      if (dateCmp !== 0) return dateCmp;
      // Higher priority first
      return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    });
}

export interface EveningCutoffStatus {
  tomorrowISO: string;
  tomorrowAssignedCount: number;
  assignedBeforeNightCount: number;
  isCutoffApproaching: boolean;
  isPastCutoff: boolean;
  minutesUntilCutoff: number;
}

export function evaluateEveningCutoff(
  tasks: DailyTask[],
  now: Date,
  todayISO: string,
  cutoffHour: number
): EveningCutoffStatus {
  const tomorrowISO = addDaysISO(todayISO, 1);
  const tomorrowTasks = tasks.filter((t) => t.dueDate === tomorrowISO);
  const assignedBeforeNightCount = tomorrowTasks.filter((t) => t.assignedBeforeNight).length;

  const cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), cutoffHour, 0, 0);
  const diffMinutes = Math.round((cutoffDate.getTime() - now.getTime()) / 60000);

  return {
    tomorrowISO,
    tomorrowAssignedCount: tomorrowTasks.length,
    assignedBeforeNightCount,
    isPastCutoff: diffMinutes < 0,
    isCutoffApproaching: diffMinutes >= 0 && diffMinutes <= 180,
    minutesUntilCutoff: Math.max(0, diffMinutes),
  };
}
