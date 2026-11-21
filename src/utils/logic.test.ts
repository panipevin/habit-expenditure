import test from 'node:test';
import assert from 'node:assert/strict';
import type { DailyTask, Expense, Habit } from '../types';
import {
  applyGracePeriod,
  claimHabitMilestone,
  evaluateHabitStreak,
  setHabitPauseState,
  toggleHabitCompletionForDate,
} from './streaks';
import {
  buildAutomatedBudgetReport,
  DEFAULT_BUDGET_LIMITS,
  generateExpensesCSV,
} from './finance';
import { evaluateEveningCutoff, filterAndSortTasks } from './tasks';
import { addDaysISO } from './dates';

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    ownerId: 'u1',
    name: 'Morning Run',
    category: 'Fitness',
    reminderTime: '07:00',
    completedDates: [],
    graceDates: [],
    graceTokensRemaining: 2,
    isPaused: false,
    claimedMilestones: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

test('habit streak increments across consecutive days and unlocks 7-day milestone', () => {
  const today = '2026-11-21';
  const days = [6, 5, 4, 3, 2, 1, 0].map((d) => addDaysISO(today, -d));
  const habit = makeHabit({ completedDates: days });
  const summary = evaluateHabitStreak(habit, today);

  assert.equal(summary.currentStreak, 7);
  assert.equal(summary.status, 'active');
  assert.equal(summary.unlockedMilestones.length, 1);
  assert.equal(summary.unlockedMilestones[0].days, 7);
  assert.equal(summary.unclaimedMilestones.length, 1);

  const claimed = claimHabitMilestone(habit, 7);
  const afterClaim = evaluateHabitStreak(claimed, today);
  assert.equal(afterClaim.unclaimedMilestones.length, 0);
  assert.equal(afterClaim.earnedXP, 7 * 15 + 100);
});

test('habit streak resets to 0 when a day is missed without grace or pause', () => {
  const today = '2026-11-21';
  // Completed 2, 3, 4 days ago, missed yesterday and today
  const habit = makeHabit({
    completedDates: ['2026-11-17', '2026-11-18', '2026-11-19'],
  });
  const summary = evaluateHabitStreak(habit, today);
  assert.equal(summary.currentStreak, 0);
  assert.equal(summary.longestStreak, 3);
  assert.equal(summary.status, 'reset');
});

test('grace period protects a missed yesterday and preserves the streak', () => {
  const today = '2026-11-21';
  const habit = makeHabit({
    completedDates: ['2026-11-17', '2026-11-18', '2026-11-19'],
    graceTokensRemaining: 2,
  });

  const { habit: shielded, appliedDate } = applyGracePeriod(habit, today);
  assert.equal(appliedDate, '2026-11-20');
  assert.equal(shielded.graceTokensRemaining, 1);

  const afterShield = evaluateHabitStreak(shielded, today);
  assert.equal(afterShield.currentStreak, 3);
  assert.equal(afterShield.status, 'at_risk');

  const completedToday = toggleHabitCompletionForDate(shielded, today);
  const afterToday = evaluateHabitStreak(completedToday, today);
  assert.equal(afterToday.currentStreak, 4);
  assert.equal(afterToday.status, 'active');
});

test('pause mode preserves streak across multi-day break and bridges upon resume', () => {
  const pauseStart = '2026-11-18';
  const resumeDay = '2026-11-21';
  const base = makeHabit({
    completedDates: ['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17'],
  });

  const paused = setHabitPauseState(base, true, pauseStart, 'Traveling');
  const whilePaused = evaluateHabitStreak(paused, resumeDay);
  assert.equal(whilePaused.status, 'paused');
  assert.equal(whilePaused.currentStreak, 4);

  const resumed = setHabitPauseState(paused, false, resumeDay);
  const afterResume = evaluateHabitStreak(resumed, resumeDay);
  assert.equal(afterResume.currentStreak, 4);
  assert.equal(afterResume.status, 'at_risk');

  const checkedIn = toggleHabitCompletionForDate(resumed, resumeDay);
  assert.equal(evaluateHabitStreak(checkedIn, resumeDay).currentStreak, 5);
});

test('automated budget report calculates spend, over-budget status, and CSV escaping', () => {
  const expenses: Expense[] = [
    {
      id: 'e1',
      ownerId: 'u1',
      title: 'Team Lunch, Downtown',
      category: 'Food',
      amount: 600,
      date: '2026-11-10',
      note: 'Client "Q4" review',
      createdAt: '2026-11-10T12:00:00Z',
      updatedAt: '2026-11-10T12:00:00Z',
    },
    {
      id: 'e2',
      ownerId: 'u1',
      title: 'Transit Pass',
      category: 'Transport',
      amount: 85.5,
      date: '2026-11-12',
      createdAt: '2026-11-12T08:00:00Z',
      updatedAt: '2026-11-12T08:00:00Z',
    },
  ];

  const report = buildAutomatedBudgetReport(expenses, DEFAULT_BUDGET_LIMITS, '2026-11-21');
  const food = report.categories.find((c) => c.category === 'Food')!;
  assert.equal(food.status, 'over');
  assert.equal(food.remaining, -50);
  assert.equal(report.totalSpent, 685.5);
  assert.ok(report.insights.some((i) => i.includes('Over budget in Food')));

  const csv = generateExpensesCSV(expenses);
  assert.ok(csv.includes('"Team Lunch, Downtown"'));
  assert.ok(csv.includes('"Client ""Q4"" review"'));
  assert.ok(csv.includes('85.50'));
});

test('pending task search and evening cutoff evaluation work accurately', () => {
  const tasks: DailyTask[] = [
    {
      id: 't1',
      ownerId: 'u1',
      title: 'Finalize Q4 release notes',
      category: 'Product',
      priority: 'urgent',
      status: 'todo',
      dueDate: '2026-11-21',
      assignedBeforeNight: true,
      reminderEnabled: true,
      createdAt: '2026-11-20T19:00:00Z',
      updatedAt: '2026-11-20T19:00:00Z',
    },
    {
      id: 't2',
      ownerId: 'u1',
      title: 'Prepare sprint demo deck',
      category: 'Product',
      priority: 'high',
      status: 'done',
      dueDate: '2026-11-21',
      assignedBeforeNight: true,
      reminderEnabled: false,
      createdAt: '2026-11-20T18:00:00Z',
      updatedAt: '2026-11-21T10:00:00Z',
    },
    {
      id: 't3',
      ownerId: 'u1',
      title: 'Audit API security rules',
      category: 'Engineering',
      priority: 'high',
      status: 'todo',
      dueDate: '2026-11-22',
      assignedBeforeNight: true,
      reminderEnabled: true,
      createdAt: '2026-11-21T18:30:00Z',
      updatedAt: '2026-11-21T18:30:00Z',
    },
  ];

  const pendingMatches = filterAndSortTasks(tasks, { searchQuery: 'release', status: 'pending' });
  assert.equal(pendingMatches.length, 1);
  assert.equal(pendingMatches[0].id, 't1');

  const doneExcluded = filterAndSortTasks(tasks, { searchQuery: 'sprint', status: 'pending' });
  assert.equal(doneExcluded.length, 0);

  const eveningNow = new Date(2026, 10, 21, 19, 30, 0); // 7:30 PM
  const cutoff = evaluateEveningCutoff(tasks, eveningNow, '2026-11-21', 21);
  assert.equal(cutoff.tomorrowISO, '2026-11-22');
  assert.equal(cutoff.tomorrowAssignedCount, 1);
  assert.equal(cutoff.isCutoffApproaching, true);
  assert.equal(cutoff.minutesUntilCutoff, 90);
});
