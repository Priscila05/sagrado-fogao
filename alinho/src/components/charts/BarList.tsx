import { formatNumber } from '../../utils/format';

export interface BarItem {
  label: string;
  value: number;
  /** Optional secondary text shown on the right (e.g. a currency total). */
  meta?: string;
}

type Tone = 'accent' | 'positive' | 'critical' | 'neutral';

const TONE_BAR: Record<Tone, string> = {
  accent: 'bg-accent/85',
  positive: 'bg-positive/80',
  critical: 'bg-critical/75',
  neutral: 'bg-line-strong',
};

/** Ranked horizontal bars — the clearest form for category comparisons. */
export function BarList({
  items,
  tone = 'accent',
  maxItems,
  valueFormatter = (value: number) => formatNumber(value),
  emptyLabel = 'Nenhum dado no período.',
}: {
  items: BarItem[];
  tone?: Tone;
  maxItems?: number;
  valueFormatter?: (value: number) => string;
  emptyLabel?: string;
}) {
  const visible = maxItems ? items.slice(0, maxItems) : items;
  const max = Math.max(1, ...visible.map((item) => item.value));

  if (visible.length === 0 || visible.every((item) => item.value === 0)) {
    return <p className="py-6 text-center text-sm text-muted">{emptyLabel}</p>;
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {visible.map((item) => (
        <li key={item.label} className="group">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm text-ink" title={item.label}>
              {item.label}
            </span>
            <span className="shrink-0 text-sm font-medium text-ink tnum">
              {valueFormatter(item.value)}
              {item.meta ? <span className="ml-2 text-xs font-normal text-subtle">{item.meta}</span> : null}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sunken">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ease-swift ${TONE_BAR[tone]}`}
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
