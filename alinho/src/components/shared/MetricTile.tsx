import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

type Tone = 'neutral' | 'accent' | 'positive' | 'caution' | 'critical';

const VALUE_TONE: Record<Tone, string> = {
  neutral: 'text-ink',
  accent: 'text-ink',
  positive: 'text-positive',
  caution: 'text-caution',
  critical: 'text-critical',
};

const ICON_TONE: Record<Tone, string> = {
  neutral: 'text-subtle',
  accent: 'text-accent',
  positive: 'text-positive',
  caution: 'text-caution',
  critical: 'text-critical',
};

/** Single KPI. Values always come from stored records — never a placeholder. */
export function MetricTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
  to,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: Tone;
  to?: string;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        {Icon ? <Icon className={`h-4 w-4 shrink-0 ${ICON_TONE[tone]}`} aria-hidden="true" /> : null}
      </div>
      <p
        className={`mt-2.5 text-2xl font-semibold tracking-[-0.02em] tnum ${VALUE_TONE[tone]}`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-subtle">{hint}</p> : null}
    </>
  );

  const className =
    'flex flex-col rounded-lg border border-line bg-surface px-4 py-3.5 shadow-card transition-all duration-150 ease-swift';

  if (to) {
    return (
      <Link
        to={to}
        className={`focus-ring ${className} hover:border-line-strong hover:shadow-pop`}
      >
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
