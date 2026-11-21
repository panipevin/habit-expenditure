export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

export function addDaysISO(iso: string, delta: number): string {
  const dt = parseDateISO(iso);
  dt.setDate(dt.getDate() + delta);
  return formatDateISO(dt);
}

export function getTodayISO(): string {
  return formatDateISO(new Date());
}

export function getPastDaysISO(todayISO: string, count: number): string[] {
  const result: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    result.push(addDaysISO(todayISO, -i));
  }
  return result;
}

export function formatShortDate(iso: string): string {
  const dt = parseDateISO(iso);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatWeekdayShort(iso: string): string {
  const dt = parseDateISO(iso);
  return dt.toLocaleDateString('en-US', { weekday: 'short' });
}

export function getMonthCalendarDays(year: number, monthIndex: number): { iso: string; inMonth: boolean; dayNum: number }[] {
  const firstDay = new Date(year, monthIndex, 1, 12, 0, 0);
  const startWeekday = firstDay.getDay(); // 0=Sun
  const start = new Date(year, monthIndex, 1 - startWeekday, 12, 0, 0);
  const cells: { iso: string; inMonth: boolean; dayNum: number }[] = [];
  for (let i = 0; i < 42; i++) {
    const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 12, 0, 0);
    cells.push({
      iso: formatDateISO(cur),
      inMonth: cur.getMonth() === monthIndex,
      dayNum: cur.getDate(),
    });
  }
  return cells;
}

export function isBeforeEveningCutoff(now: Date, cutoffHour: number): boolean {
  return now.getHours() < cutoffHour;
}

export function formatHourLabel(hour24: number): string {
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const h12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${h12}:00 ${suffix}`;
}
