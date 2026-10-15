/** Brazilian formatting helpers: currency, numbers, dates, phones. */

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactCurrencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('pt-BR');

const percentFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return currencyFormatter.format(0);
  return currencyFormatter.format(value);
}

/** Currency without cents — for dashboard tiles and column totals. */
export function formatCurrencyShort(value: number): string {
  if (!Number.isFinite(value)) return compactCurrencyFormatter.format(0);
  return compactCurrencyFormatter.format(value);
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return numberFormatter.format(value);
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0,0%';
  return `${percentFormatter.format(value)}%`;
}

/** Parses "1.234,56", "1234.56" or "R$ 1.234,56" into a number. */
export function parseCurrencyInput(input: string): number {
  if (typeof input !== 'string') return 0;
  const cleaned = input.replace(/[^\d,.-]/g, '').trim();
  if (!cleaned) return 0;
  const hasComma = cleaned.includes(',');
  const normalized = hasComma
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(/,/g, '');
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : 0;
}

/* ------------------------------------------------------------------ phone --- */

/** Keeps only digits, dropping a leading Brazilian country code. */
export function phoneDigits(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length > 11 && digits.startsWith('55')) return digits.slice(2);
  return digits;
}

/** Formats a Brazilian phone as (11) 91234-5678 / (11) 1234-5678. */
export function formatPhone(raw: string): string {
  const digits = phoneDigits(raw);
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 9) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  if (digits.length === 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return raw || '';
}

/** A Brazilian landline or mobile number has 10 or 11 digits. */
export function isValidPhone(raw: string): boolean {
  const digits = phoneDigits(raw);
  return digits.length === 10 || digits.length === 11;
}

export function isValidEmail(raw: string): boolean {
  const value = (raw || '').trim();
  if (!value) return false;
  if (value.length > 254) return false;
  return /^[^\s@,;:<>()[\]\\]+@[^\s@.,;:<>()[\]\\]+(\.[^\s@.,;:<>()[\]\\]+)+$/.test(value);
}

/* ------------------------------------------------------------------- misc --- */

export function initialsOf(...names: string[]): string {
  const source = names.find((name) => name && name.trim().length > 0) || '';
  const parts = source.trim().split(/\s+/).slice(0, 2);
  const letters = parts.map((part) => part.charAt(0)).join('');
  return letters.toUpperCase() || '—';
}

/** Case/accent-insensitive comparison key used across search and sorting. */
export function normalizeText(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function truncate(value: string, max: number): string {
  if (!value) return '';
  return value.length > max ? `${value.slice(0, Math.max(0, max - 1))}…` : value;
}
