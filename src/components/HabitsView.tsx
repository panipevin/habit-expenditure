import React, { useMemo, useState } from 'react';
import {
  Award,
  Check,
  Flame,
  Pause,
  Play,
  Plus,
  Shield,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  evaluateHabitStreak,
  getRankTitle,
  STREAK_MILESTONES,
} from '../utils/streaks';
import { formatWeekdayShort, getPastDaysISO } from '../utils/dates';

export const HabitsView: React.FC = () => {
  const {
    todayISO,
    habits,
    addHabit,
    toggleHabitToday,
    useHabitGracePeriod,
    toggleHabitPause,
    claimMilestoneReward,
    deleteHabit,
  } = useWorkspace();

  const [composerOpen, setComposerOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Focus');
  const [reminderTime, setReminderTime] = useState('08:00');
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [pauseModalHabitId, setPauseModalHabitId] = useState<string | null>(null);
  const [pauseReason, setPauseReason] = useState('Travel / planned break');

  const last7Days = useMemo(() => getPastDaysISO(todayISO, 7), [todayISO]);

  const enriched = useMemo(
    () => habits.map((habit) => ({ habit, summary: evaluateHabitStreak(habit, todayISO) })),
    [habits, todayISO]
  );

  const totalXP = useMemo(
    () => enriched.reduce((sum, item) => sum + item.summary.earnedXP, 0),
    [enriched]
  );
  const longestOverall = useMemo(
    () => enriched.reduce((max, item) => Math.max(max, item.summary.longestStreak), 0),
    [enriched]
  );
  const rank = useMemo(() => getRankTitle(totalXP), [totalXP]);

  const handleAddHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Enter a habit name.');
      return;
    }
    setFormError(null);
    addHabit({ name, category, reminderTime });
    setName('');
    setComposerOpen(false);
  };

  const handleGrace = (habitId: string) => {
    const result = useHabitGracePeriod(habitId);
    setFeedback(result.message);
  };

  const handleConfirmPause = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pauseModalHabitId) return;
    toggleHabitPause(pauseModalHabitId, true, pauseReason);
    setFeedback('Habit paused. Your consecutive streak is safely preserved until you resume.');
    setPauseModalHabitId(null);
    setPauseReason('Travel / planned break');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#556075] dark:text-[#8B97AD]">
            Gamified streak engine · 7d, 30d &amp; 100d milestone bonuses · Grace shields &amp; pause protection
          </p>
          <h1 className="mt-1 font-display text-2xl lg:text-3xl font-semibold tracking-tight text-[#0E1525] dark:text-[#F1F5F9]">
            Habit Streaks
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setComposerOpen((prev) => !prev)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] dark:bg-[#3B82F6] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#1E40AF] dark:hover:bg-[#2563EB] transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          {composerOpen ? 'Close Form' : 'New Habit'}
        </button>
      </div>

      {/* Gamified Milestone & Rank Banner */}
      <section
        aria-label="Streak rank and milestone rewards"
        className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-6"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-5 space-y-2">
            <div className="flex items-center gap-2.5">
              <Trophy className="w-5 h-5 text-[#D97706] dark:text-[#F59E0B]" />
              <span className="text-xs font-medium text-[#556075] dark:text-[#94A3B8]">
                Current Recognition Tier
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <h2 className="font-display text-xl font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
                {rank.rank}
              </h2>
              <span className="font-mono text-sm font-semibold tabular-nums text-[#EA580C] dark:text-[#F59E0B]">
                {totalXP.toLocaleString('en-IN')} XP
              </span>
            </div>
            <p className="text-xs text-[#556075] dark:text-[#94A3B8]">
              Longest recorded streak: <span className="font-mono font-semibold tabular-nums text-[#0E1525] dark:text-[#F1F5F9]">{longestOverall} days</span> · Next tier at{' '}
              <span className="font-mono tabular-nums">{rank.nextThreshold.toLocaleString('en-IN')} XP</span>
            </p>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#E2E6ED] dark:divide-[#1F2737] border-t lg:border-t-0 lg:border-l border-[#E2E6ED] dark:border-[#1F2737] pt-4 lg:pt-0 lg:pl-6">
            {STREAK_MILESTONES.map((milestone) => {
              const unlockedCount = enriched.filter((item) =>
                item.summary.unlockedMilestones.some((m) => m.days === milestone.days)
              ).length;
              return (
                <div
                  key={milestone.days}
                  className="py-3 sm:py-0 sm:px-4 first:pt-0 sm:first:pl-0 last:pb-0 sm:last:pr-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold tabular-nums text-[#EA580C] dark:text-[#F59E0B]">
                      <Award className="w-3.5 h-3.5" />
                      {milestone.days} Days
                    </span>
                    <span className="font-mono text-xs tabular-nums text-[#556075] dark:text-[#8B97AD]">
                      +{milestone.rewardXP} XP
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
                    {milestone.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#556075] dark:text-[#8B97AD]">
                    {unlockedCount > 0 ? `Unlocked on ${unlockedCount} habit${unlockedCount === 1 ? '' : 's'}` : milestone.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {feedback && (
        <div className="rounded-lg border border-[#1D4ED8]/30 bg-[#1D4ED8]/5 dark:bg-[#3B82F6]/10 px-4 py-3 flex items-center justify-between gap-3 text-xs text-[#0E1525] dark:text-[#F1F5F9]">
          <span>{feedback}</span>
          <button
            type="button"
            aria-label="Dismiss notice"
            onClick={() => setFeedback(null)}
            className="text-[#556075] hover:text-[#0E1525] dark:hover:text-[#F1F5F9]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* New Habit Composer */}
      {composerOpen && (
        <form
          onSubmit={handleAddHabit}
          className="rounded-xl bg-white dark:bg-[#121722] border border-[#1D4ED8]/40 dark:border-[#3B82F6]/40 p-6 space-y-4"
        >
          <h2 className="font-display text-base font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
            Create Tracked Habit
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label htmlFor="habit-name" className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8] mb-1">
                Habit name
              </label>
              <input
                id="habit-name"
                type="text"
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Zero Inbox Review"
                className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3.5 py-2 text-sm text-[#0E1525] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label htmlFor="habit-category" className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8] mb-1">
                Category
              </label>
              <select
                id="habit-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3 py-2 text-sm text-[#0E1525] dark:text-[#F1F5F9]"
              >
                <option value="Focus">Focus</option>
                <option value="Fitness">Fitness</option>
                <option value="Planning">Planning</option>
                <option value="Learning">Learning</option>
                <option value="Health">Health</option>
              </select>
            </div>
            <div>
              <label htmlFor="habit-reminder" className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8] mb-1">
                Daily reminder
              </label>
              <input
                id="habit-reminder"
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3 py-2 text-sm font-mono text-[#0E1525] dark:text-[#F1F5F9]"
              />
            </div>
          </div>
          {formError && <p className="text-xs font-medium text-[#DC2626]">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setComposerOpen(false)}
              className="rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] px-4 py-2 text-xs font-medium text-[#556075] dark:text-[#94A3B8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0E1525] dark:bg-[#F1F5F9] px-4 py-2 text-xs font-medium text-white dark:text-[#0E1525]"
            >
              Create Habit
            </button>
          </div>
        </form>
      )}

      {/* Habit Streak Cards Grid */}
      {enriched.length === 0 ? (
        <section className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-10 text-center space-y-3">
          <div className="mx-auto w-10 h-10 rounded-full bg-[#EA580C]/10 text-[#EA580C] dark:text-[#F59E0B] flex items-center justify-center">
            <Flame className="w-5 h-5" />
          </div>
          <h2 className="font-display text-base font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
            Start your first daily habit streak
          </h2>
          <p className="max-w-md mx-auto text-xs text-[#556075] dark:text-[#8B97AD] leading-relaxed">
            Build consecutive daily streaks, unlock 7-day, 30-day, and 100-day XP milestone rewards, and protect streaks with Grace Shields or Pause mode.
          </p>
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] dark:bg-[#3B82F6] px-4 py-2 text-xs font-medium text-white hover:bg-[#1E40AF] dark:hover:bg-[#2563EB]"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Your First Habit
          </button>
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {enriched.map(({ habit, summary }) => {
          const flameHot = summary.currentStreak > 0 && !habit.isPaused;
          return (
            <article
              key={habit.id}
              className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-6 flex flex-col justify-between gap-5"
            >
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-semibold text-[#0E1525] dark:text-[#F1F5F9] truncate">
                      {habit.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-[#556075] dark:text-[#8B97AD]">
                      {habit.category} · Reminder {habit.reminderTime} ·{' '}
                      {summary.status === 'paused'
                        ? `Paused (${habit.pauseReason || 'Break'})`
                        : summary.status === 'grace'
                        ? 'Grace shield active today'
                        : summary.status === 'at_risk'
                        ? 'Due today to maintain streak'
                        : summary.status === 'active'
                        ? 'Completed today'
                        : 'Streak reset — start fresh today'}
                    </p>
                  </div>

                  {/* Prominent Flame Streak Indicator */}
                  <div
                    className="flex items-center gap-1.5 shrink-0"
                    aria-label={`${summary.currentStreak} day streak`}
                  >
                    <Flame
                      className={`w-6 h-6 ${
                        habit.isPaused
                          ? 'text-[#64748B]'
                          : flameHot
                          ? 'text-[#EA580C] dark:text-[#F59E0B] fill-current'
                          : 'text-[#CBD5E1] dark:text-[#334155]'
                      }`}
                    />
                    <span className="font-mono text-2xl font-bold tabular-nums text-[#0E1525] dark:text-[#F1F5F9]">
                      {summary.currentStreak}
                    </span>
                    <span className="text-xs text-[#556075] dark:text-[#8B97AD]">days</span>
                  </div>
                </div>

                {/* Unclaimed Milestone Bonus Banner */}
                {summary.unclaimedMilestones.length > 0 && (
                  <div className="mt-4 rounded-lg border border-[#D97706]/40 bg-[#FEF3C7]/60 dark:bg-[#78350F]/25 px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#92400E] dark:text-[#FBBF24]">
                        Milestone Reached: {summary.unclaimedMilestones[0].title} ({summary.unclaimedMilestones[0].days} Days)
                      </p>
                      <p className="text-[11px] text-[#B45309] dark:text-[#FCD34D]">
                        Claim +{summary.unclaimedMilestones[0].rewardXP} XP bonus recognition
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        claimMilestoneReward(habit.id, summary.unclaimedMilestones[0].days)
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#D97706] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#B45309] transition-colors whitespace-nowrap shrink-0"
                    >
                      <Trophy className="w-3.5 h-3.5" />
                      Claim +{summary.unclaimedMilestones[0].rewardXP} XP
                    </button>
                  </div>
                )}

                {/* Next Milestone Progress Bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#556075] dark:text-[#94A3B8]">
                      {summary.nextMilestone
                        ? `Next milestone: ${summary.nextMilestone.title} (${summary.nextMilestone.days}d)`
                        : 'All streak milestones unlocked'}
                    </span>
                    <span className="font-mono tabular-nums text-[#0E1525] dark:text-[#F1F5F9]">
                      {summary.progressToNextPct}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-[#E2E6ED] dark:bg-[#1F2737] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#EA580C] dark:bg-[#F59E0B] transition-all"
                      style={{ width: `${summary.progressToNextPct}%` }}
                    />
                  </div>
                </div>

                {/* 7-Day Visual Continuity Strip */}
                <div className="mt-4 grid grid-cols-7 gap-2">
                  {last7Days.map((dayISO) => {
                    const done = habit.completedDates.includes(dayISO);
                    const shielded = habit.graceDates.includes(dayISO);
                    const pausedDay = habit.isPaused && habit.pausedSince && dayISO >= habit.pausedSince;
                    return (
                      <div key={dayISO} className="text-center">
                        <span className="block text-[10px] text-[#556075] dark:text-[#8B97AD] mb-1">
                          {formatWeekdayShort(dayISO)}
                        </span>
                        <div
                          title={`${dayISO}: ${done ? 'Completed' : shielded ? 'Grace shield' : pausedDay ? 'Paused' : 'Not logged'}`}
                          className={`h-8 rounded-md border flex items-center justify-center text-xs ${
                            done
                              ? 'bg-[#EA580C]/15 border-[#EA580C]/40 text-[#EA580C] dark:bg-[#F59E0B]/20 dark:border-[#F59E0B]/40 dark:text-[#FBBF24]'
                              : shielded
                              ? 'bg-[#1D4ED8]/10 border-[#1D4ED8]/30 text-[#1D4ED8] dark:text-[#60A5FA]'
                              : pausedDay
                              ? 'bg-[#E2E6ED]/60 dark:bg-[#1F2737] border-dashed border-[#94A3B8] text-[#556075]'
                              : 'bg-[#F6F7F9] dark:bg-[#0A0D14] border-[#E2E6ED] dark:border-[#1F2737] text-transparent'
                          }`}
                        >
                          {done ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : shielded ? (
                            <Shield className="w-3.5 h-3.5" />
                          ) : pausedDay ? (
                            <Pause className="w-3 h-3" />
                          ) : (
                            '·'
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Footer */}
              <div className="pt-4 border-t border-[#E2E6ED] dark:border-[#1F2737] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    disabled={habit.isPaused}
                    onClick={() => toggleHabitToday(habit.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap disabled:opacity-40 ${
                      summary.completedToday
                        ? 'bg-[#16A34A] text-white hover:bg-[#15803D]'
                        : 'bg-[#0E1525] dark:bg-[#F1F5F9] text-white dark:text-[#0E1525] hover:opacity-90'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    {summary.completedToday ? 'Completed Today' : 'Check In Today'}
                  </button>

                  {!habit.isPaused && (
                    <button
                      type="button"
                      onClick={() => handleGrace(habit.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] px-3 py-2 text-xs font-medium text-[#0E1525] dark:text-[#F1F5F9] hover:bg-[#F6F7F9] dark:hover:bg-[#1A2130] transition-colors whitespace-nowrap"
                    >
                      <Shield className="w-3.5 h-3.5 text-[#1D4ED8] dark:text-[#60A5FA]" />
                      Grace Shield ({habit.graceTokensRemaining})
                    </button>
                  )}

                  {habit.isPaused ? (
                    <button
                      type="button"
                      onClick={() => {
                        toggleHabitPause(habit.id, false);
                        setFeedback(`Resumed "${habit.name}". Prior ${summary.currentStreak}-day streak preserved.`);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#1D4ED8] px-3 py-2 text-xs font-medium text-[#1D4ED8] dark:text-[#60A5FA] hover:bg-[#1D4ED8]/10 transition-colors whitespace-nowrap"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Resume Habit
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPauseModalHabitId(habit.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] px-3 py-2 text-xs font-medium text-[#556075] dark:text-[#94A3B8] hover:text-[#0E1525] dark:hover:text-[#F1F5F9] transition-colors whitespace-nowrap"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      Pause
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => deleteHabit(habit.id)}
                  aria-label={`Delete habit "${habit.name}"`}
                  className="p-2 rounded-lg text-[#556075] hover:text-[#DC2626] transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </article>
          );
        })}
        </div>
      )}

      {/* Pause Habit Modal */}
      {pauseModalHabitId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-habit-title"
        >
          <form
            onSubmit={handleConfirmPause}
            className="w-full max-w-md rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-6 space-y-4"
          >
            <h2 id="pause-habit-title" className="font-display text-lg font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
              Pause Habit Without Losing Streak
            </h2>
            <p className="text-xs text-[#556075] dark:text-[#94A3B8] leading-relaxed">
              Pausing freezes your consecutive streak during unavoidable breaks (travel, illness, or recovery). When you resume, paused days are bridged automatically.
            </p>
            <div>
              <label htmlFor="pause-reason-input" className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8] mb-1">
                Reason for pause
              </label>
              <input
                id="pause-reason-input"
                type="text"
                maxLength={120}
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3.5 py-2 text-sm text-[#0E1525] dark:text-[#F1F5F9]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPauseModalHabitId(null)}
                className="rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] px-4 py-2 text-xs font-medium text-[#556075] dark:text-[#94A3B8]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#0E1525] dark:bg-[#F1F5F9] px-4 py-2 text-xs font-medium text-white dark:text-[#0E1525]"
              >
                Confirm Pause
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
