import React, { useMemo, useState } from 'react';
import { Download, Plus, Trash2 } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import type { ExpenseCategory } from '../types';
import {
  buildAutomatedBudgetReport,
  EXPENSE_CATEGORIES,
  generateExpensesCSV,
} from '../utils/finance';
import { formatShortDate } from '../utils/dates';

export const ExpensesView: React.FC = () => {
  const {
    todayISO,
    expenses,
    budgetLimits,
    addExpense,
    deleteExpense,
    updateBudgetLimit,
  } = useWorkspace();

  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'All'>('All');
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingBudgets, setEditingBudgets] = useState(false);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Food');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const report = useMemo(
    () => buildAutomatedBudgetReport(expenses, budgetLimits, todayISO),
    [expenses, budgetLimits, todayISO]
  );

  const visibleExpenses = useMemo(() => {
    return [...expenses]
      .filter((e) => categoryFilter === 'All' || e.category === categoryFilter)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, categoryFilter]);

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = Number(amount);
    if (!title.trim()) {
      setError('Enter an expense description.');
      return;
    }
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setError('Enter a valid amount greater than 0.');
      return;
    }
    setError(null);
    addExpense({
      title,
      category,
      amount: numeric,
      date,
      note,
    });
    setTitle('');
    setAmount('');
    setNote('');
    setComposerOpen(false);
  };

  const handleExportCSV = () => {
    const csvContent = generateExpensesCSV(visibleExpenses);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cadence-expenses-${report.monthKey}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExportNotice(`Exported ${visibleExpenses.length} expense records to cadence-expenses-${report.monthKey}.csv`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#556075] dark:text-[#8B97AD]">
            Private personal ledger · Automated monthly budget reports &amp; CSV export
          </p>
          <h1 className="mt-1 font-display text-2xl lg:text-3xl font-semibold tracking-tight text-[#0E1525] dark:text-[#F1F5F9]">
            Daily Expenses
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-white dark:bg-[#121722] px-3.5 py-2 text-xs font-medium text-[#0E1525] dark:text-[#F1F5F9] hover:bg-[#F6F7F9] dark:hover:bg-[#1A2130] whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Download CSV
          </button>
          <button
            type="button"
            onClick={() => setComposerOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] dark:bg-[#3B82F6] px-4 py-2 text-xs font-medium text-white hover:bg-[#1E40AF] dark:hover:bg-[#2563EB] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Log Expense
          </button>
        </div>
      </div>

      {exportNotice && (
        <p className="rounded-lg border border-[#16A34A]/30 bg-[#16A34A]/10 px-4 py-2.5 text-xs font-medium text-[#15803D] dark:text-[#4ADE80]">
          {exportNotice}
        </p>
      )}

      {/* Monthly Summary Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-5">
          <p className="text-xs text-[#556075] dark:text-[#8B97AD]">Spent ({report.monthKey})</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-[#0E1525] dark:text-[#F1F5F9]">
            ${report.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-5">
          <p className="text-xs text-[#556075] dark:text-[#8B97AD]">Monthly Budget</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-[#0E1525] dark:text-[#F1F5F9]">
            ${report.totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-5">
          <p className="text-xs text-[#556075] dark:text-[#8B97AD]">Remaining Balance</p>
          <p
            className={`mt-1.5 font-mono text-2xl font-semibold tabular-nums ${
              report.remainingBudget < 0
                ? 'text-[#DC2626] dark:text-[#F87171]'
                : 'text-[#16A34A] dark:text-[#4ADE80]'
            }`}
          >
            ${report.remainingBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-5">
          <p className="text-xs text-[#556075] dark:text-[#8B97AD]">Daily Pace</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-[#0E1525] dark:text-[#F1F5F9]">
            ${report.dailyAverage.toFixed(2)}
          </p>
        </div>
      </section>

      {/* Log Expense Form */}
      {composerOpen && (
        <form
          onSubmit={handleAddExpense}
          className="rounded-xl bg-white dark:bg-[#121722] border border-[#1D4ED8]/40 p-6 space-y-4"
        >
          <h2 className="font-display text-base font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
            Record Daily Expense
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="exp-title" className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8] mb-1">
                Description
              </label>
              <input
                id="exp-title"
                type="text"
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Studio lunch & espresso"
                className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3.5 py-2 text-sm text-[#0E1525] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label htmlFor="exp-category" className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8] mb-1">
                Category
              </label>
              <select
                id="exp-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3 py-2 text-sm text-[#0E1525] dark:text-[#F1F5F9]"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="exp-amount" className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8] mb-1">
                Amount (USD)
              </label>
              <input
                id="exp-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="24.50"
                className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3 py-2 text-sm font-mono text-[#0E1525] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label htmlFor="exp-date" className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8] mb-1">
                Date
              </label>
              <input
                id="exp-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3 py-2 text-sm font-mono text-[#0E1525] dark:text-[#F1F5F9]"
              />
            </div>
            <div className="md:col-span-3">
              <label htmlFor="exp-note" className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8] mb-1">
                Note (optional)
              </label>
              <input
                id="exp-note"
                type="text"
                maxLength={240}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Merchant, project code, or receipt memo"
                className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3.5 py-2 text-sm text-[#0E1525] dark:text-[#F1F5F9]"
              />
            </div>
          </div>
          {error && <p className="text-xs font-medium text-[#DC2626]">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setComposerOpen(false)}
              className="rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] px-4 py-2 text-xs font-medium text-[#556075]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0E1525] dark:bg-[#F1F5F9] px-4 py-2 text-xs font-medium text-white dark:text-[#0E1525]"
            >
              Save Expense
            </button>
          </div>
        </form>
      )}

      {/* Automated Budget Report & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-7 rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#E2E6ED] dark:border-[#1F2737]">
            <h2 className="font-display text-base font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
              Category Budgets
            </h2>
            <button
              type="button"
              onClick={() => setEditingBudgets((prev) => !prev)}
              className="text-xs font-medium text-[#1D4ED8] dark:text-[#60A5FA] hover:underline"
            >
              {editingBudgets ? 'Done Editing' : 'Edit Monthly Caps'}
            </button>
          </div>

          <div className="space-y-4">
            {report.categories.map((cat) => (
              <div key={cat.category} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium text-[#0E1525] dark:text-[#F1F5F9]">
                    {cat.category}
                  </span>
                  <div className="flex items-center gap-2 font-mono tabular-nums">
                    <span className="text-[#0E1525] dark:text-[#F1F5F9]">
                      ${cat.spent.toFixed(2)}
                    </span>
                    <span className="text-[#556075] dark:text-[#8B97AD]">/</span>
                    {editingBudgets ? (
                      <input
                        type="number"
                        aria-label={`Monthly cap for ${cat.category}`}
                        value={cat.limit}
                        onChange={(e) => updateBudgetLimit(cat.category, Number(e.target.value))}
                        className="w-20 rounded border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-2 py-0.5 text-right text-xs text-[#0E1525] dark:text-[#F1F5F9]"
                      />
                    ) : (
                      <span className="text-[#556075] dark:text-[#8B97AD]">
                        ${cat.limit.toFixed(0)} ({cat.utilizationPct}%)
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-[#E2E6ED] dark:bg-[#1F2737] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      cat.status === 'over'
                        ? 'bg-[#DC2626]'
                        : cat.status === 'warning'
                        ? 'bg-[#D97706]'
                        : 'bg-[#1D4ED8] dark:bg-[#3B82F6]'
                    }`}
                    style={{ width: `${Math.min(100, cat.utilizationPct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-5 rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-6 space-y-4">
          <div className="pb-3 border-b border-[#E2E6ED] dark:border-[#1F2737]">
            <h2 className="font-display text-base font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
              Automated Budget Insights
            </h2>
            <p className="text-xs text-[#556075] dark:text-[#8B97AD]">
              Calculated live from your {report.monthKey} expense ledger
            </p>
          </div>
          <ul className="divide-y divide-[#E2E6ED] dark:divide-[#1F2737]">
            {report.insights.map((line, i) => (
              <li key={i} className="py-3 text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
                {line}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Expense Ledger Table */}
      <section className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E2E6ED] dark:border-[#1F2737] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
            Transaction Ledger ({visibleExpenses.length})
          </h2>
          <select
            aria-label="Filter expenses by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as ExpenseCategory | 'All')}
            className="h-9 rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3 text-xs text-[#0E1525] dark:text-[#F1F5F9]"
          >
            <option value="All">All categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2E6ED] dark:border-[#1F2737] text-xs font-medium text-[#556075] dark:text-[#8B97AD]">
                <th className="py-3 px-6">Date</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-6 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E6ED] dark:divide-[#1F2737] text-sm">
              {visibleExpenses.map((exp) => (
                <tr
                  key={exp.id}
                  className="hover:bg-[#F6F7F9]/60 dark:hover:bg-[#1A2130]/40 transition-colors"
                >
                  <td className="py-3 px-6 font-mono text-xs tabular-nums text-[#556075] dark:text-[#94A3B8] whitespace-nowrap">
                    {formatShortDate(exp.date)}
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-medium text-[#0E1525] dark:text-[#F1F5F9]">{exp.title}</p>
                    {exp.note && (
                      <p className="text-xs text-[#556075] dark:text-[#8B97AD]">{exp.note}</p>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs text-[#556075] dark:text-[#94A3B8] whitespace-nowrap">
                    {exp.category}
                  </td>
                  <td className="py-3 px-6 text-right font-mono text-sm font-medium tabular-nums text-[#0E1525] dark:text-[#F1F5F9] whitespace-nowrap">
                    ${exp.amount.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      aria-label={`Delete expense "${exp.title}"`}
                      onClick={() => deleteExpense(exp.id)}
                      className="p-1.5 rounded text-[#556075] hover:text-[#DC2626]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
