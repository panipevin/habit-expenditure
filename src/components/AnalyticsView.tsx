import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useWorkspace } from '../context/WorkspaceContext';
import { formatShortDate, getPastDaysISO } from '../utils/dates';
import { buildAutomatedBudgetReport } from '../utils/finance';
import { evaluateHabitStreak } from '../utils/streaks';

export const AnalyticsView: React.FC = () => {
  const { todayISO, tasks, habits, expenses, budgetLimits, boards, theme } = useWorkspace();

  const habitSeries = useMemo(() => {
    const days = getPastDaysISO(todayISO, 14);
    return days.map((iso) => {
      const completed = habits.filter((h) => h.completedDates.includes(iso)).length;
      const shielded = habits.filter((h) => h.graceDates.includes(iso)).length;
      return {
        label: formatShortDate(iso),
        completed,
        shielded,
      };
    });
  }, [habits, todayISO]);

  const budgetReport = useMemo(
    () => buildAutomatedBudgetReport(expenses, budgetLimits, todayISO),
    [expenses, budgetLimits, todayISO]
  );

  const budgetChartData = useMemo(
    () =>
      budgetReport.categories.map((c) => ({
        category: c.category,
        Spent: c.spent,
        Budget: c.limit,
      })),
    [budgetReport]
  );

  const completionPct = useMemo(() => {
    if (tasks.length === 0) return 0;
    return Math.round((tasks.filter((t) => t.status === 'done').length / tasks.length) * 100);
  }, [tasks]);

  const avgStreak = useMemo(() => {
    if (habits.length === 0) return 0;
    const sum = habits.reduce((acc, h) => acc + evaluateHabitStreak(h, todayISO).currentStreak, 0);
    return Math.round((sum / habits.length) * 10) / 10;
  }, [habits, todayISO]);

  const boardItemsTotal = boards.reduce((s, b) => s + b.items.length, 0);
  const boardItemsDone = boards.reduce(
    (s, b) => s + b.items.filter((i) => i.status === 'done').length,
    0
  );

  const axisColor = theme === 'dark' ? '#8B97AD' : '#556075';
  const gridColor = theme === 'dark' ? '#1F2737' : '#E2E6ED';

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium text-[#556075] dark:text-[#8B97AD]">
          Unified progress analytics · Tasks, habit consistency, team velocity &amp; spending
        </p>
        <h1 className="mt-1 font-display text-2xl lg:text-3xl font-semibold tracking-tight text-[#0E1525] dark:text-[#F1F5F9]">
          Progress Analytics
        </h1>
      </div>

      {/* KPI Row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-5">
          <p className="text-xs text-[#556075] dark:text-[#8B97AD]">Task Completion Rate</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-[#0E1525] dark:text-[#F1F5F9]">
            {completionPct}%
          </p>
        </div>
        <div className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-5">
          <p className="text-xs text-[#556075] dark:text-[#8B97AD]">Average Active Streak</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-[#EA580C] dark:text-[#F59E0B]">
            {avgStreak}d
          </p>
        </div>
        <div className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-5">
          <p className="text-xs text-[#556075] dark:text-[#8B97AD]">Team Cards Shipped</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-[#0E1525] dark:text-[#F1F5F9]">
            {boardItemsDone}/{boardItemsTotal}
          </p>
        </div>
        <div className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-5">
          <p className="text-xs text-[#556075] dark:text-[#8B97AD]">Budget Utilization</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-[#0E1525] dark:text-[#F1F5F9]">
            {budgetReport.utilizationPct}%
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 14-Day Habit Consistency */}
        <section className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-6">
          <div className="mb-4">
            <h2 className="font-display text-base font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
              14-Day Habit Consistency
            </h2>
            <p className="text-xs text-[#556075] dark:text-[#8B97AD]">
              Daily completed habits across the past two weeks
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={habitSeries} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? '#121722' : '#FFFFFF',
                    borderColor: gridColor,
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  name="Completed"
                  stroke="#EA580C"
                  fill="#EA580C"
                  fillOpacity={0.18}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Budget vs Actual Spend */}
        <section className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-6">
          <div className="mb-4">
            <h2 className="font-display text-base font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
              Spending vs. Monthly Budget
            </h2>
            <p className="text-xs text-[#556075] dark:text-[#8B97AD]">
              Category spend compared against configured monthly caps (USD)
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={budgetChartData} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="category" tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? '#121722' : '#FFFFFF',
                    borderColor: gridColor,
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="Budget" fill={theme === 'dark' ? '#334155' : '#CBD5E1'} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Spent" fill="#1D4ED8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
};
