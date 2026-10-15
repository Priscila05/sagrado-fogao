import type { ElementType, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { PRIORITY_LABEL, type Priority, type StageKind } from '../../models/types';

/* ------------------------------------------------------------------- card --- */

export function Panel({
  children,
  className = '',
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
}) {
  return (
    <Tag className={`rounded-lg border border-line bg-surface shadow-card ${className}`}>
      {children}
    </Tag>
  );
}

export function PanelHeader({
  title,
  description,
  action,
  className = '',
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5 ${className}`}
    >
      <div className="min-w-0">
        <h2 className="text-md font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ badge --- */

type BadgeTone = 'neutral' | 'accent' | 'positive' | 'caution' | 'critical' | 'outline';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-sunken text-muted',
  accent: 'bg-accent-soft text-accent-ink',
  positive: 'bg-positive-soft text-positive-ink',
  caution: 'bg-caution-soft text-caution-ink',
  critical: 'bg-critical-soft text-critical-ink',
  outline: 'border border-line text-muted',
};

export function Badge({
  children,
  tone = 'neutral',
  icon: Icon,
  className = '',
}: {
  children: ReactNode;
  tone?: BadgeTone;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-2xs font-medium ${BADGE_TONES[tone]} ${className}`}
    >
      {Icon ? <Icon className="h-3 w-3" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

const PRIORITY_TONE: Record<Priority, BadgeTone> = {
  alta: 'critical',
  media: 'caution',
  baixa: 'neutral',
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge tone={PRIORITY_TONE[priority]}>{PRIORITY_LABEL[priority]}</Badge>;
}

const STAGE_TONE: Record<StageKind, BadgeTone> = {
  aberta: 'accent',
  ganha: 'positive',
  perdida: 'critical',
};

export function StageBadge({ name, kind }: { name: string; kind: StageKind }) {
  return <Badge tone={STAGE_TONE[kind]}>{name}</Badge>;
}

/** Small dot used to mark priority inside dense lists. */
export function PriorityDot({ priority }: { priority: Priority }) {
  const color =
    priority === 'alta' ? 'bg-critical' : priority === 'media' ? 'bg-caution' : 'bg-line-strong';
  return (
    <span
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${color}`}
      title={`Prioridade ${PRIORITY_LABEL[priority].toLowerCase()}`}
    />
  );
}

/* ------------------------------------------------------------- empty state --- */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14'}`}
    >
      <span
        className={`flex items-center justify-center rounded-lg border border-line bg-sunken text-subtle ${compact ? 'h-9 w-9' : 'h-11 w-11'}`}
      >
        <Icon className={compact ? 'h-4 w-4' : 'h-5 w-5'} aria-hidden="true" />
      </span>
      <div className="max-w-sm">
        <p className={`font-semibold text-ink ${compact ? 'text-base' : 'text-md'}`}>{title}</p>
        {description ? <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/* --------------------------------------------------------------- skeletons --- */

export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`skeleton h-3 rounded-sm ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <SkeletonLine className="w-1/3" />
      <SkeletonLine className="mt-3 w-2/3" />
      <SkeletonLine className="mt-2 w-1/2" />
    </div>
  );
}

/* ------------------------------------------------------------------ misc ---- */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="label-eyebrow mb-1.5">{eyebrow}</p> : null}
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-base leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {/* No shrink-0 here: on a 320px screen the action buttons must be able to wrap. */}
      {actions ? <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function InlineLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="focus-ring rounded-sm font-medium text-accent underline-offset-2 transition-colors hover:underline"
    >
      {children}
    </Link>
  );
}

/** Definition pair used across detail pages. */
export function DataRow({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-0.5 ${className}`}>
      <dt className="text-2xs font-medium uppercase tracking-[0.05em] text-subtle">{label}</dt>
      <dd className="min-w-0 break-words text-base text-ink">{children}</dd>
    </div>
  );
}

export function Divider({ className = '' }: { className?: string }) {
  return <hr className={`border-t border-line ${className}`} />;
}

/** Keyboard-reachable segmented control. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: string; icon?: LucideIcon }[];
  onChange: (next: T) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex items-center gap-0.5 rounded-md border border-line bg-sunken p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={[
              'focus-ring inline-flex items-center gap-1.5 rounded-sm font-medium transition-all duration-150 ease-swift',
              size === 'sm' ? 'h-6 px-2 text-xs' : 'h-7 px-2.5 text-sm',
              active
                ? 'bg-surface text-ink shadow-subtle'
                : 'text-muted hover:text-ink',
            ].join(' ')}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
