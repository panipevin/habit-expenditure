import type { BudgetLimits, Expense, ExpenseCategory } from '../types';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Food',
  'Transport',
  'Housing',
  'Software',
  'Health',
  'Utilities',
  'Leisure',
];

// Default monthly caps in Indian Rupees (INR); fully editable per category in the Expenses view.
export const DEFAULT_BUDGET_LIMITS: BudgetLimits = {
  Food: 10000,
  Transport: 4000,
  Housing: 25000,
  Software: 2000,
  Health: 3000,
  Utilities: 4000,
  Leisure: 5000,
};

export function formatINR(amount: number, showDecimals = true): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const isNegative = safe < 0;
  const formatted = Math.abs(safe).toLocaleString('en-IN', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  });
  return `${isNegative ? '-' : ''}₹${formatted}`;
}

export interface CategoryBudgetReport {
  category: ExpenseCategory;
  spent: number;
  limit: number;
  remaining: number;
  utilizationPct: number;
  status: 'healthy' | 'warning' | 'over';
  transactionCount: number;
}

export interface AutomatedBudgetReport {
  monthKey: string; // YYYY-MM
  totalSpent: number;
  totalBudget: number;
  remainingBudget: number;
  utilizationPct: number;
  dailyAverage: number;
  projectedMonthSpend: number;
  categories: CategoryBudgetReport[];
  insights: string[];
}

export function buildAutomatedBudgetReport(
  expenses: Expense[],
  limits: BudgetLimits,
  referenceDateISO: string
): AutomatedBudgetReport {
  const monthKey = referenceDateISO.slice(0, 7);
  const dayOfMonth = Math.max(1, Number(referenceDateISO.slice(8, 10)) || 1);
  const [year, month] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  const monthExpenses = expenses.filter((e) => e.date.startsWith(monthKey));

  const categories: CategoryBudgetReport[] = EXPENSE_CATEGORIES.map((category) => {
    const items = monthExpenses.filter((e) => e.category === category);
    const spent = round2(items.reduce((sum, e) => sum + e.amount, 0));
    const limit = limits[category] || 0;
    const remaining = round2(limit - spent);
    const utilizationPct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
    const status: CategoryBudgetReport['status'] =
      utilizationPct > 100 ? 'over' : utilizationPct >= 80 ? 'warning' : 'healthy';
    return {
      category,
      spent,
      limit,
      remaining,
      utilizationPct,
      status,
      transactionCount: items.length,
    };
  });

  const totalSpent = round2(categories.reduce((s, c) => s + c.spent, 0));
  const totalBudget = round2(categories.reduce((s, c) => s + c.limit, 0));
  const remainingBudget = round2(totalBudget - totalSpent);
  const utilizationPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const dailyAverage = round2(totalSpent / dayOfMonth);
  const projectedMonthSpend = round2(dailyAverage * daysInMonth);

  const insights: string[] = [];

  if (monthExpenses.length === 0) {
    insights.push(
      `No expenses logged for ${monthKey} yet. Record your first daily expense to unlock automated spending pace and savings forecasts.`
    );
  } else {
    const overCategories = categories.filter((c) => c.status === 'over');
    const warningCategories = categories.filter((c) => c.status === 'warning');

    if (overCategories.length > 0) {
      const names = overCategories
        .map((c) => `${c.category} (+${formatINR(Math.abs(c.remaining))})`)
        .join(', ');
      insights.push(`Over budget in ${names}. Review recurring charges before month-end.`);
    }
    if (warningCategories.length > 0) {
      const names = warningCategories.map((c) => `${c.category} (${c.utilizationPct}%)`).join(', ');
      insights.push(`Approaching monthly cap in ${names}.`);
    }
    if (projectedMonthSpend > totalBudget && totalBudget > 0) {
      insights.push(
        `At ${formatINR(dailyAverage)}/day, projected spend (${formatINR(projectedMonthSpend)}) exceeds your ${formatINR(totalBudget)} monthly plan.`
      );
    } else if (totalBudget > 0) {
      const projectedSavings = round2(totalBudget - projectedMonthSpend);
      insights.push(
        `Current pace (${formatINR(dailyAverage)}/day) is on track to save ${formatINR(projectedSavings)} this month.`
      );
    }

    const topCategory = [...categories].sort((a, b) => b.spent - a.spent)[0];
    if (topCategory && topCategory.spent > 0) {
      insights.push(
        `Largest category: ${topCategory.category} at ${formatINR(topCategory.spent)} (${topCategory.transactionCount} ${topCategory.transactionCount === 1 ? 'entry' : 'entries'}).`
      );
    }
  }

  return {
    monthKey,
    totalSpent,
    totalBudget,
    remainingBudget,
    utilizationPct,
    dailyAverage,
    projectedMonthSpend,
    categories,
    insights,
  };
}

function escapeCSVCell(value: string | number): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateExpensesCSV(expenses: Expense[]): string {
  const headers = ['Date', 'Title', 'Category', 'Amount (INR)', 'Notes'];
  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date));
  const rows = sorted.map((e) =>
    [
      escapeCSVCell(e.date),
      escapeCSVCell(e.title),
      escapeCSVCell(e.category),
      escapeCSVCell(e.amount.toFixed(2)),
      escapeCSVCell(e.note || ''),
    ].join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
