import type { Habit } from '../types';
import { addDaysISO } from './dates';

export interface StreakMilestone {
  days: number;
  title: string;
  rewardXP: number;
  tier: 'bronze' | 'silver' | 'gold';
  description: string;
}

export const STREAK_MILESTONES: StreakMilestone[] = [
  {
    days: 7,
    title: 'Week Igniter',
    rewardXP: 100,
    tier: 'bronze',
    description: '7 consecutive days of steady execution.',
  },
  {
    days: 30,
    title: 'Monthly Forge',
    rewardXP: 500,
    tier: 'silver',
    description: '30 consecutive days — habit locked into routine.',
  },
  {
    days: 100,
    title: 'Centurion Flame',
    rewardXP: 2000,
    tier: 'gold',
    description: '100 consecutive days of elite consistency.',
  },
];

export interface HabitStreakSummary {
  currentStreak: number;
  longestStreak: number;
  completedToday: boolean;
  protectedToday: boolean;
  status: 'active' | 'at_risk' | 'paused' | 'grace' | 'reset';
  nextMilestone: StreakMilestone | null;
  progressToNextPct: number;
  unlockedMilestones: StreakMilestone[];
  unclaimedMilestones: StreakMilestone[];
  earnedXP: number;
}

/**
 * Computes consecutive streak, longest streak, status, and milestone rewards.
 * Rules:
 * - Completed days increment the streak.
 * - Grace-protected days bridge gaps without breaking the streak (and do not artificially inflate completion counts if used alone, though they preserve consecutive continuity).
 * - If a habit is paused (`isPaused && pausedSince`), evaluation freezes at the day before `pausedSince` so unavoidable breaks never reset the streak.
 * - If yesterday (and today) are both missed without grace or pause, currentStreak resets to 0.
 */
export function evaluateHabitStreak(habit: Habit, todayISO: string): HabitStreakSummary {
  const completedSet = new Set(habit.completedDates);
  const graceSet = new Set(habit.graceDates);
  const completedToday = completedSet.has(todayISO);
  const protectedToday = graceSet.has(todayISO);

  // Determine the anchor date from which to count backwards.
  // If paused, freeze evaluation at the day immediately preceding pausedSince (or pausedSince if completed on that day).
  let anchorISO = todayISO;
  if (habit.isPaused && habit.pausedSince) {
    anchorISO = completedSet.has(habit.pausedSince)
      ? habit.pausedSince
      : addDaysISO(habit.pausedSince, -1);
  }

  let currentStreak = 0;
  let cursor = anchorISO;

  // If not paused and today is neither completed nor grace-protected, check yesterday to see if streak is still alive (at risk) or reset.
  if (!habit.isPaused && !completedSet.has(cursor) && !graceSet.has(cursor)) {
    const yesterday = addDaysISO(cursor, -1);
    if (completedSet.has(yesterday) || graceSet.has(yesterday)) {
      cursor = yesterday;
    } else {
      currentStreak = 0;
      cursor = '';
    }
  }

  if (cursor) {
    let safety = 0;
    while (safety < 1500) {
      if (completedSet.has(cursor)) {
        currentStreak += 1;
        cursor = addDaysISO(cursor, -1);
      } else if (graceSet.has(cursor)) {
        // Grace bridges the day so streak does not break
        cursor = addDaysISO(cursor, -1);
      } else {
        break;
      }
      safety += 1;
    }
  }

  // Compute longest streak across all recorded dates (completed + grace bridges)
  const allDates = Array.from(new Set([...habit.completedDates, ...habit.graceDates])).sort();
  let longestStreak = currentStreak;
  if (allDates.length > 0) {
    let run = 0;
    let prev: string | null = null;
    for (const d of allDates) {
      if (prev && addDaysISO(prev, 1) !== d) {
        run = 0;
      }
      if (completedSet.has(d)) {
        run += 1;
        if (run > longestStreak) longestStreak = run;
      }
      prev = d;
    }
  }

  let status: HabitStreakSummary['status'] = 'reset';
  if (habit.isPaused) {
    status = 'paused';
  } else if (completedToday) {
    status = 'active';
  } else if (protectedToday) {
    status = 'grace';
  } else if (currentStreak > 0) {
    status = 'at_risk';
  } else {
    status = 'reset';
  }

  const peakForMilestones = Math.max(currentStreak, longestStreak);
  const unlockedMilestones = STREAK_MILESTONES.filter((m) => peakForMilestones >= m.days);
  const unclaimedMilestones = unlockedMilestones.filter(
    (m) => !habit.claimedMilestones.includes(m.days)
  );
  const nextMilestone = STREAK_MILESTONES.find((m) => currentStreak < m.days) || null;
  const prevTarget = nextMilestone
    ? STREAK_MILESTONES.filter((m) => m.days < nextMilestone.days).pop()?.days ?? 0
    : 100;
  const progressToNextPct = nextMilestone
    ? Math.min(
        100,
        Math.max(0, Math.round(((currentStreak - prevTarget) / (nextMilestone.days - prevTarget)) * 100))
      )
    : 100;

  const baseXP = habit.completedDates.length * 15;
  const milestoneXP = STREAK_MILESTONES.filter((m) => habit.claimedMilestones.includes(m.days)).reduce(
    (sum, m) => sum + m.rewardXP,
    0
  );

  return {
    currentStreak,
    longestStreak,
    completedToday,
    protectedToday,
    status,
    nextMilestone,
    progressToNextPct,
    unlockedMilestones,
    unclaimedMilestones,
    earnedXP: baseXP + milestoneXP,
  };
}

export function toggleHabitCompletionForDate(habit: Habit, dateISO: string): Habit {
  const exists = habit.completedDates.includes(dateISO);
  const nextCompleted = exists
    ? habit.completedDates.filter((d) => d !== dateISO)
    : [...habit.completedDates, dateISO].sort().slice(-366);

  return {
    ...habit,
    completedDates: nextCompleted,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Applies a 1-day grace period shield (either to yesterday if missed, or to today)
 * to prevent streak reset during an unavoidable break.
 */
export function applyGracePeriod(habit: Habit, todayISO: string): { habit: Habit; appliedDate: string | null; reason?: string } {
  if (habit.isPaused) {
    return { habit, appliedDate: null, reason: 'Habit is already paused.' };
  }
  if (habit.graceTokensRemaining <= 0) {
    return { habit, appliedDate: null, reason: 'No grace shields remaining this month.' };
  }

  const yesterdayISO = addDaysISO(todayISO, -1);
  const completedSet = new Set(habit.completedDates);
  const graceSet = new Set(habit.graceDates);

  let targetDate: string | null = null;
  if (!completedSet.has(yesterdayISO) && !graceSet.has(yesterdayISO)) {
    targetDate = yesterdayISO;
  } else if (!completedSet.has(todayISO) && !graceSet.has(todayISO)) {
    targetDate = todayISO;
  }

  if (!targetDate) {
    return { habit, appliedDate: null, reason: 'Yesterday and today are already covered.' };
  }

  return {
    appliedDate: targetDate,
    habit: {
      ...habit,
      graceDates: [...habit.graceDates, targetDate].sort().slice(-60),
      graceTokensRemaining: habit.graceTokensRemaining - 1,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function setHabitPauseState(
  habit: Habit,
  paused: boolean,
  todayISO: string,
  reason?: string
): Habit {
  if (paused) {
    return {
      ...habit,
      isPaused: true,
      pausedSince: todayISO,
      pauseReason: (reason || 'Planned break').trim().slice(0, 120),
      updatedAt: new Date().toISOString(),
    };
  }

  // When resuming from a pause, automatically bridge the paused dates via graceDates
  // so continuity is preserved seamlessly after resume without losing prior streak!
  const bridgedDates = new Set(habit.graceDates);
  if (habit.pausedSince && habit.pausedSince < todayISO) {
    let cursor = habit.pausedSince;
    let guard = 0;
    while (cursor < todayISO && guard < 45) {
      if (!habit.completedDates.includes(cursor)) {
        bridgedDates.add(cursor);
      }
      cursor = addDaysISO(cursor, 1);
      guard += 1;
    }
  }

  return {
    ...habit,
    isPaused: false,
    pausedSince: undefined,
    pauseReason: undefined,
    graceDates: Array.from(bridgedDates).sort().slice(-60),
    updatedAt: new Date().toISOString(),
  };
}

export function claimHabitMilestone(habit: Habit, milestoneDays: number): Habit {
  if (habit.claimedMilestones.includes(milestoneDays)) return habit;
  return {
    ...habit,
    claimedMilestones: [...habit.claimedMilestones, milestoneDays].sort((a, b) => a - b).slice(0, 10),
    updatedAt: new Date().toISOString(),
  };
}

export function getRankTitle(totalXP: number): { rank: string; nextThreshold: number } {
  if (totalXP >= 4000) return { rank: 'Grand Architect', nextThreshold: 6000 };
  if (totalXP >= 2000) return { rank: 'Streak Sentinel', nextThreshold: 4000 };
  if (totalXP >= 800) return { rank: 'Momentum Builder', nextThreshold: 2000 };
  return { rank: 'Cadence Initiate', nextThreshold: 800 };
}
