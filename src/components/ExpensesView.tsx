import React, { useEffect, useMemo, useState } from 'react';
import { Check, Download, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import type { Expense, ExpenseCategory } from '../types';
import {
  buildAutomatedBudgetReport,
  formatINR,
  generateExpensesCSV,
  MAX_EXPENSE_CATEGORIES,
  MAX_EXPENSE_CATEGORY_LENGTH,
} from '../utils/finance';
import { formatShortDate } from '../utils/dates';

export const ExpensesView: React.FC = () => {
  const {
    todayISO,
    expenses,
    expenseCategories,
    budgetLimits,
    addExpense,
    updateExpense,
    deleteExpense,
    addExpenseCategory,
    renameExpenseCategory,
    deleteExpenseCategory,
    isReadOnlyView,
    viewingAccountName,
  } = useWorkspace();

  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'All'>('All');
  const [composerOpen, setComposerOpen] = useState(false);

  // New expense composer state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>(expenseCategories[0] || 'Food');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Quick add-category inside composer
  const [quickCatOpen, setQuickCatOpen] = useState(false);
  const [quickCatName, setQuickCatName] = useState('');
  const [quickCatError, setQuickCatError] = useState<string | null>(null);

  // Category manager state (Add / Edit / Delete in Category Budgets)
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryLimit, setNewCategoryLimit] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryLimit, setEditCategoryLimit] = useState('');
  const [editCategoryError, setEditCategoryError] = useState<string | null>(null);

  // Inline edit existing expense state
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editExpTitle, setEditExpTitle] = useState('');
  const [editExpCategory, setEditExpCategory] = useState<ExpenseCategory>('');
  const [editExpAmount, setEditExpAmount] = useState('');
  const [editExpDate, setEditExpDate] = useState('');
  const [editExpNote, setEditExpNote] = useState('');

  // Keep selected composer category & filter valid whenever categories change
  useEffect(() => {
    if (expenseCategories.length > 0 && !expenseCategories.includes(category)) {
      setCategory(expenseCategories[0]);
    }
    if (categoryFilter !== 'All' && !expenseCategories.includes(categoryFilter)) {
      setCategoryFilter('All');
    }
  }, [expenseCategories, category, categoryFilter]);

  const report = useMemo(
    () => buildAutomatedBudgetReport(expenses, budgetLimits, todayISO, expenseCategories),
    [expenses, budgetLimits, todayISO, expenseCategories]
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

  const handleQuickAddCategory = () => {
    const res = addExpenseCategory(quickCatName, 0);
    if (!res.ok || !res.category) {
      setQuickCatError(res.error || 'Could not add category.');
      return;
    }
    setCategory(res.category);
    setQuickCatName('');
    setQuickCatError(null);
    setQuickCatOpen(false);
  };

  const handleAddCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLimit = newCategoryLimit.trim() === '' ? 0 : Number(newCategoryLimit);
    if (!Number.isFinite(parsedLimit) || parsedLimit < 0) {
      setCategoryError('Enter a valid monthly cap (0 or greater).');
      return;
    }
    const res = addExpenseCategory(newCategoryName, parsedLimit);
    if (!res.ok) {
      setCategoryError(res.error || 'Could not add category.');
      return;
    }
    setNewCategoryName('');
    setNewCategoryLimit('');
    setCategoryError(null);
    setAddingCategory(false);
  };

  const startEditingCategory = (catName: string, currentLimit: number) => {
    setAddingCategory(false);
    setCategoryError(null);
    setEditingCategory(catName);
    setEditCategoryName(catName);
    setEditCategoryLimit(String(currentLimit));
    setEditCategoryError(null);
  };

  const handleSaveCategoryEdit = (oldName: string) => {
    const parsedLimit = editCategoryLimit.trim() === '' ? 0 : Number(editCategoryLimit);
    if (!Number.isFinite(parsedLimit) || parsedLimit < 0) {
      setEditCategoryError('Enter a valid monthly cap (0 or greater).');
      return;
    }
    const res = renameExpenseCategory(oldName, editCategoryName, parsedLimit);
    if (!res.ok || !res.category) {
      setEditCategoryError(res.error || 'Could not update category.');
      return;
    }
    if (category === oldName) {
      setCategory(res.category);
    }
    if (categoryFilter === oldName) {
      setCategoryFilter(res.category);
    }
    setEditingCategory(null);
    setEditCategoryError(null);
  };

  const handleDeleteCategory = (catName: string) => {
    const res = deleteExpenseCategory(catName);
    if (!res.ok) {
      setEditCategoryError(res.error || 'Could not remove category.');
      return;
    }
    setEditingCategory(null);
    setEditCategoryError(null);
  };

  const startEditingExpense = (exp: Expense) => {
    setEditingExpenseId(exp.id);
    setEditExpTitle(exp.title);
    setEditExpCategory(exp.category);
    setEditExpAmount(String(exp.amount));
    setEditExpDate(exp.date);
    setEditExpNote(exp.note || '');
  };

  const handleSaveExpenseEdit = (id: string) => {
    const numeric = Number(editExpAmount);
    if (!editExpTitle.trim() || !Number.isFinite(numeric) || numeric <= 0) {
      return;
    }
    updateExpense(id, {
      title: editExpTitle,
      category: editExpCategory,
      amount: numeric,
      date: editExpDate,
      note: editExpNote,
    });
    setEditingExpenseId(null);
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
            {isReadOnlyView && viewingAccountName ? `${viewingAccountName}'s Expenses` : 'Daily Expenses'}
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
          {!isReadOnlyView && (
            <button
              type="button"
              onClick={() => setComposerOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] dark:bg-[#3B82F6] px-4 py-2 text-xs font-medium text-white hover:bg-[#1E40AF] dark:hover:bg-[#2563EB] whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Log Expense
            </button>
          )}
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
            {formatINR(report.totalSpent)}
          </p>
        </div>
        <div className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-5">
          <p className="text-xs text-[#556075] dark:text-[#8B97AD]">Monthly Budget</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-[#0E1525] dark:text-[#F1F5F9]">
            {formatINR(report.totalBudget)}
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
            {formatINR(report.remainingBudget)}
          </p>
        </div>
        <div className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-5">
          <p className="text-xs text-[#556075] dark:text-[#8B97AD]">Daily Pace</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-[#0E1525] dark:text-[#F1F5F9]">
            {formatINR(report.dailyAverage)}
          </p>
        </div>
      </section>

      {/* Log Expense Form */}
      {composerOpen && !isReadOnlyView && (
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
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="exp-category" className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8]">
                  Category
                </label>
                {expenseCategories.length < MAX_EXPENSE_CATEGORIES && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuickCatOpen((prev) => !prev);
                      setQuickCatError(null);
                    }}
                    className="text-[11px] font-medium text-[#1D4ED8] dark:text-[#60A5FA] hover:underline"
                  >
                    {quickCatOpen ? 'Close' : '+ New'}
                  </button>
                )}
              </div>
              <select
                id="exp-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3 py-2 text-sm text-[#0E1525] dark:text-[#F1F5F9]"
              >
                {expenseCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {quickCatOpen && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      aria-label="New category name"
                      maxLength={MAX_EXPENSE_CATEGORY_LENGTH}
                      value={quickCatName}
                      onChange={(e) => setQuickCatName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleQuickAddCategory();
                        }
                      }}
                      placeholder="e.g. Groceries"
                      className="min-w-0 flex-1 rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-2.5 py-1.5 text-xs text-[#0E1525] dark:text-[#F1F5F9]"
                    />
                    <button
                      type="button"
                      onClick={handleQuickAddCategory}
                      className="rounded-lg bg-[#1D4ED8] dark:bg-[#3B82F6] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#1E40AF]"
                    >
                      Add
                    </button>
                  </div>
                  {quickCatError && <p className="text-[11px] font-medium text-[#DC2626]">{quickCatError}</p>}
                </div>
              )}
            </div>
            <div>
              <label htmlFor="exp-amount" className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8] mb-1">
                Amount (INR ₹)
              </label>
              <input
                id="exp-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="450.00"
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
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E2E6ED] dark:border-[#1F2737]">
            <div>
              <h2 className="font-display text-base font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
                Categories &amp; Monthly Budgets
              </h2>
              <p className="text-[11px] text-[#556075] dark:text-[#8B97AD]">
                {isReadOnlyView
                  ? 'Read-only monthly category spending and budget caps'
                  : 'Add custom categories or click edit to rename & adjust monthly caps'}
              </p>
            </div>
            {!isReadOnlyView && (
              <button
                type="button"
                disabled={expenseCategories.length >= MAX_EXPENSE_CATEGORIES}
                onClick={() => {
                  setEditingCategory(null);
                  setEditCategoryError(null);
                  setCategoryError(null);
                  setAddingCategory((prev) => !prev);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3 py-1.5 text-xs font-medium text-[#1D4ED8] dark:text-[#60A5FA] hover:bg-[#EEF2FF] dark:hover:bg-[#1A2130] disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Category
              </button>
            )}
          </div>

          {addingCategory && !isReadOnlyView && (
            <form
              onSubmit={handleAddCategorySubmit}
              className="rounded-lg border border-[#1D4ED8]/30 bg-[#F6F7F9]/80 dark:bg-[#0A0D14] p-3.5 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-6">
                  <label htmlFor="new-cat-name" className="block text-[11px] font-medium text-[#556075] dark:text-[#8B97AD] mb-1">
                    Category Name
                  </label>
                  <input
                    id="new-cat-name"
                    type="text"
                    maxLength={MAX_EXPENSE_CATEGORY_LENGTH}
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g. Groceries, EMI, Fuel"
                    className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-white dark:bg-[#121722] px-3 py-1.5 text-xs text-[#0E1525] dark:text-[#F1F5F9]"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label htmlFor="new-cat-limit" className="block text-[11px] font-medium text-[#556075] dark:text-[#8B97AD] mb-1">
                    Monthly Cap (₹)
                  </label>
                  <input
                    id="new-cat-limit"
                    type="number"
                    min="0"
                    step="1"
                    value={newCategoryLimit}
                    onChange={(e) => setNewCategoryLimit(e.target.value)}
                    placeholder="5000"
                    className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-white dark:bg-[#121722] px-3 py-1.5 text-xs font-mono text-[#0E1525] dark:text-[#F1F5F9]"
                  />
                </div>
                <div className="sm:col-span-2 flex items-end gap-1.5">
                  <button
                    type="submit"
                    className="flex-1 rounded-lg bg-[#1D4ED8] dark:bg-[#3B82F6] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1E40AF]"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    aria-label="Cancel adding category"
                    onClick={() => {
                      setAddingCategory(false);
                      setCategoryError(null);
                    }}
                    className="rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] p-1.5 text-[#556075] hover:text-[#0E1525] dark:hover:text-[#F1F5F9]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {categoryError && <p className="text-xs font-medium text-[#DC2626]">{categoryError}</p>}
            </form>
          )}

          <div className="space-y-4">
            {report.categories.map((cat) => {
              const isEditing = editingCategory === cat.category;
              const isConfigured = expenseCategories.includes(cat.category);
              const existingCount = expenses.filter((e) => e.category === cat.category).length;

              return (
                <div key={cat.category} className="space-y-1.5">
                  {isEditing ? (
                    <div className="rounded-lg border border-[#1D4ED8]/35 bg-[#F6F7F9]/80 dark:bg-[#0A0D14] p-3 space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                        <div className="sm:col-span-5">
                          <label
                            htmlFor={`edit-cat-name-${cat.category}`}
                            className="block text-[11px] font-medium text-[#556075] dark:text-[#8B97AD] mb-1"
                          >
                            Category Name
                          </label>
                          <input
                            id={`edit-cat-name-${cat.category}`}
                            type="text"
                            maxLength={MAX_EXPENSE_CATEGORY_LENGTH}
                            value={editCategoryName}
                            onChange={(e) => setEditCategoryName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveCategoryEdit(cat.category);
                              } else if (e.key === 'Escape') {
                                setEditingCategory(null);
                                setEditCategoryError(null);
                              }
                            }}
                            className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-white dark:bg-[#121722] px-2.5 py-1.5 text-xs text-[#0E1525] dark:text-[#F1F5F9]"
                          />
                        </div>
                        <div className="sm:col-span-4">
                          <label
                            htmlFor={`edit-cat-limit-${cat.category}`}
                            className="block text-[11px] font-medium text-[#556075] dark:text-[#8B97AD] mb-1"
                          >
                            Monthly Cap (₹)
                          </label>
                          <input
                            id={`edit-cat-limit-${cat.category}`}
                            type="number"
                            min="0"
                            step="1"
                            value={editCategoryLimit}
                            onChange={(e) => setEditCategoryLimit(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveCategoryEdit(cat.category);
                              }
                            }}
                            className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-white dark:bg-[#121722] px-2.5 py-1.5 text-right text-xs font-mono text-[#0E1525] dark:text-[#F1F5F9]"
                          />
                        </div>
                        <div className="sm:col-span-3 flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            aria-label={`Save category ${cat.category}`}
                            onClick={() => handleSaveCategoryEdit(cat.category)}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#1D4ED8] dark:bg-[#3B82F6] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#1E40AF]"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Save
                          </button>
                          <button
                            type="button"
                            aria-label={`Cancel editing ${cat.category}`}
                            onClick={() => {
                              setEditingCategory(null);
                              setEditCategoryError(null);
                            }}
                            className="rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] p-1.5 text-[#556075] hover:text-[#0E1525] dark:hover:text-[#F1F5F9]"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          {expenseCategories.length > 1 && (
                            <button
                              type="button"
                              aria-label={`Delete category ${cat.category}`}
                              title={
                                existingCount > 0
                                  ? `Delete category (${existingCount} expense${existingCount === 1 ? '' : 's'} will move to ${expenseCategories.find((c) => c !== cat.category)})`
                                  : `Delete category ${cat.category}`
                              }
                              onClick={() => handleDeleteCategory(cat.category)}
                              className="rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] p-1.5 text-[#556075] hover:border-[#DC2626]/40 hover:text-[#DC2626]"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      {existingCount > 0 && (
                        <p className="text-[11px] text-[#556075] dark:text-[#8B97AD]">
                          Renaming updates all {existingCount} logged {existingCount === 1 ? 'expense' : 'expenses'} in this category.
                        </p>
                      )}
                      {editCategoryError && (
                        <p className="text-xs font-medium text-[#DC2626]">{editCategoryError}</p>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-[#0E1525] dark:text-[#F1F5F9] truncate">
                            {cat.category}
                          </span>
                          {isConfigured && !isReadOnlyView && (
                            <button
                              type="button"
                              aria-label={`Edit category ${cat.category}`}
                              onClick={() => startEditingCategory(cat.category, cat.limit)}
                              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[#556075] dark:text-[#8B97AD] hover:bg-[#F6F7F9] dark:hover:bg-[#1A2130] hover:text-[#1D4ED8] dark:hover:text-[#60A5FA]"
                            >
                              <Pencil className="w-3 h-3" />
                              <span className="hidden sm:inline">Edit</span>
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2 font-mono tabular-nums shrink-0">
                          <span className="text-[#0E1525] dark:text-[#F1F5F9]">
                            {formatINR(cat.spent)}
                          </span>
                          <span className="text-[#556075] dark:text-[#8B97AD]">/</span>
                          <span className="text-[#556075] dark:text-[#8B97AD]">
                            {cat.limit > 0
                              ? `${formatINR(cat.limit, false)} (${cat.utilizationPct}%)`
                              : 'No cap'}
                          </span>
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
                          style={{ width: `${cat.limit > 0 ? Math.min(100, cat.utilizationPct) : 0}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
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
            {expenseCategories.map((c) => (
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
                {!isReadOnlyView && <th className="py-3 px-4 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E6ED] dark:divide-[#1F2737] text-sm">
              {visibleExpenses.length === 0 ? (
                <tr>
                  <td
                    colSpan={isReadOnlyView ? 4 : 5}
                    className="py-10 px-6 text-center text-xs text-[#556075] dark:text-[#8B97AD]"
                  >
                    {isReadOnlyView
                      ? 'No expenses recorded yet on this account.'
                      : 'No expenses recorded yet. Click "Log Expense" above to start tracking in INR (₹).'}
                  </td>
                </tr>
              ) : (
                visibleExpenses.map((exp) => {
                  const isEditingExp = !isReadOnlyView && editingExpenseId === exp.id;

                  if (isEditingExp) {
                    const rowCategories = expenseCategories.includes(editExpCategory)
                      ? expenseCategories
                      : [editExpCategory, ...expenseCategories];

                    return (
                      <tr key={exp.id} className="bg-[#F6F7F9]/80 dark:bg-[#1A2130]/50">
                        <td className="py-2.5 px-6 whitespace-nowrap">
                          <input
                            type="date"
                            aria-label="Edit expense date"
                            value={editExpDate}
                            onChange={(e) => setEditExpDate(e.target.value)}
                            className="rounded border border-[#E2E6ED] dark:border-[#1F2737] bg-white dark:bg-[#0A0D14] px-2 py-1 text-xs font-mono text-[#0E1525] dark:text-[#F1F5F9]"
                          />
                        </td>
                        <td className="py-2.5 px-4 space-y-1">
                          <input
                            type="text"
                            aria-label="Edit expense description"
                            maxLength={120}
                            value={editExpTitle}
                            onChange={(e) => setEditExpTitle(e.target.value)}
                            className="w-full rounded border border-[#E2E6ED] dark:border-[#1F2737] bg-white dark:bg-[#0A0D14] px-2.5 py-1 text-xs text-[#0E1525] dark:text-[#F1F5F9]"
                          />
                          <input
                            type="text"
                            aria-label="Edit expense note"
                            maxLength={240}
                            value={editExpNote}
                            onChange={(e) => setEditExpNote(e.target.value)}
                            placeholder="Note (optional)"
                            className="w-full rounded border border-[#E2E6ED] dark:border-[#1F2737] bg-white dark:bg-[#0A0D14] px-2.5 py-1 text-[11px] text-[#556075] dark:text-[#94A3B8]"
                          />
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <select
                            aria-label="Edit expense category"
                            value={editExpCategory}
                            onChange={(e) => setEditExpCategory(e.target.value)}
                            className="rounded border border-[#E2E6ED] dark:border-[#1F2737] bg-white dark:bg-[#0A0D14] px-2 py-1 text-xs text-[#0E1525] dark:text-[#F1F5F9]"
                          >
                            {rowCategories.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-6 text-right whitespace-nowrap">
                          <input
                            type="number"
                            aria-label="Edit expense amount"
                            step="0.01"
                            min="0.01"
                            value={editExpAmount}
                            onChange={(e) => setEditExpAmount(e.target.value)}
                            className="w-24 rounded border border-[#E2E6ED] dark:border-[#1F2737] bg-white dark:bg-[#0A0D14] px-2 py-1 text-right text-xs font-mono text-[#0E1525] dark:text-[#F1F5F9]"
                          />
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={`Save expense "${exp.title}"`}
                              onClick={() => handleSaveExpenseEdit(exp.id)}
                              className="p-1.5 rounded text-[#16A34A] hover:bg-[#16A34A]/10"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              aria-label="Cancel expense edit"
                              onClick={() => setEditingExpenseId(null)}
                              className="p-1.5 rounded text-[#556075] hover:text-[#0E1525] dark:hover:text-[#F1F5F9]"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
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
                        {formatINR(exp.amount)}
                      </td>
                      {!isReadOnlyView && (
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={`Edit expense "${exp.title}"`}
                              onClick={() => startEditingExpense(exp)}
                              className="p-1.5 rounded text-[#556075] hover:text-[#1D4ED8] dark:hover:text-[#60A5FA]"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete expense "${exp.title}"`}
                              onClick={() => deleteExpense(exp.id)}
                              className="p-1.5 rounded text-[#556075] hover:text-[#DC2626]"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
