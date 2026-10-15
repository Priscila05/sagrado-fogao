import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type Size = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-on hover:bg-accent-hover active:translate-y-px shadow-subtle disabled:bg-accent/50',
  secondary:
    'bg-surface text-ink border border-line hover:border-line-strong hover:bg-sunken active:translate-y-px',
  ghost: 'text-muted hover:bg-sunken hover:text-ink',
  subtle: 'bg-sunken text-ink hover:bg-line/70',
  danger:
    'bg-critical text-white hover:brightness-95 active:translate-y-px shadow-subtle disabled:opacity-60',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-sm gap-1.5 rounded',
  md: 'h-9 px-3.5 text-base gap-2 rounded-md',
  lg: 'h-11 px-5 text-md gap-2 rounded-md',
  icon: 'h-9 w-9 justify-center rounded-md',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    icon,
    iconRight,
    fullWidth = false,
    className = '',
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'focus-ring inline-flex select-none items-center justify-center font-medium transition-all duration-150 ease-swift',
        'disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0',
        VARIANTS[variant],
        SIZES[size],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : icon ? (
        <span className="shrink-0" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children ? <span className="truncate">{children}</span> : null}
      {iconRight && !loading ? (
        <span className="shrink-0" aria-hidden="true">
          {iconRight}
        </span>
      ) : null}
    </button>
  );
});
