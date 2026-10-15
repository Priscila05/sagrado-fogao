/** Date helpers. Everything is stored as ISO 8601; display uses pt-BR. */

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
});

const monthFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'short',
  year: '2-digit',
});

const dayMonthFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
});

const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' });

export function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? dateFormatter.format(date) : '—';
}

export function formatDateTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? dateTimeFormatter.format(date) : '—';
}

export function formatTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? timeFormatter.format(date) : '—';
}

export function formatDayMonth(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? dayMonthFormatter.format(date) : '—';
}

export function formatMonthLabel(value: string | Date): string {
  const date = toDate(value);
  if (!date) return '—';
  return monthFormatter.format(date).replace('.', '');
}

export function formatWeekday(value: string | Date): string {
  const date = toDate(value);
  if (!date) return '';
  const label = weekdayFormatter.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function startOfDay(value: Date = new Date()): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfDay(value: Date = new Date()): Date {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

export function addDays(value: Date, days: number): Date {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

export function addMonths(value: Date, months: number): Date {
  const date = new Date(value);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return date;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(value: string | Date | null | undefined): boolean {
  const date = toDate(value);
  return date ? isSameDay(date, new Date()) : false;
}

/** True when the moment is strictly in the past. */
export function isOverdue(value: string | Date | null | undefined): boolean {
  const date = toDate(value);
  if (!date) return false;
  return date.getTime() < Date.now();
}

/** True when the date falls before today — used for "next contact" alerts. */
export function isBeforeToday(value: string | Date | null | undefined): boolean {
  const date = toDate(value);
  if (!date) return false;
  return date.getTime() < startOfDay().getTime();
}

export function daysBetween(a: Date, b: Date): number {
  const diff = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(diff / 86400000);
}

/** "hoje", "amanhã", "em 3 dias", "há 2 dias". */
export function relativeDayLabel(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  const diff = daysBetween(new Date(), date);
  if (diff === 0) return 'hoje';
  if (diff === 1) return 'amanhã';
  if (diff === -1) return 'ontem';
  if (diff > 1) return `em ${diff} dias`;
  return `há ${Math.abs(diff)} dias`;
}

/** Converts an ISO string to the value expected by <input type="datetime-local">. */
export function toDateTimeInputValue(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** Converts an ISO string to the value expected by <input type="date">. */
export function toDateInputValue(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Reads a datetime-local / date input back into an ISO string (local time). */
export function fromDateInputValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value.length <= 10 ? `${value}T12:00` : value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Inclusive list of day buckets between two dates. */
export function eachDay(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  let cursor = startOfDay(from);
  const limit = startOfDay(to);
  let guard = 0;
  while (cursor.getTime() <= limit.getTime() && guard < 1000) {
    days.push(new Date(cursor));
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return days;
}

/** Inclusive list of month buckets between two dates. */
export function eachMonth(from: Date, to: Date): Date[] {
  const months: Date[] = [];
  let cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const limit = new Date(to.getFullYear(), to.getMonth(), 1);
  let guard = 0;
  while (cursor.getTime() <= limit.getTime() && guard < 240) {
    months.push(new Date(cursor));
    cursor = addMonths(cursor, 1);
    guard += 1;
  }
  return months;
}

export function monthKey(value: string | Date): string {
  const date = toDate(value);
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function dayKey(value: string | Date): string {
  const date = toDate(value);
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}
