import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const CONTROL_BASE =
  'w-full rounded-md border bg-surface px-3 text-base text-ink transition-colors duration-150 placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent disabled:bg-sunken disabled:text-muted';

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (props: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
  className?: string;
}

/** Label + control + hint/error, wired with the right aria attributes. */
export function Field({ label, hint, error, required, children, className = '' }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required ? (
          <span className="ml-0.5 text-critical" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errorId} className="text-xs text-critical" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: string;
  error?: string;
  /** Static adornment rendered inside the field, e.g. a currency symbol. */
  adornment?: ReactNode;
}

export function TextInput({
  label,
  hint,
  error,
  required,
  adornment,
  className = '',
  ...rest
}: TextInputProps) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          {adornment ? (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">
              {adornment}
            </span>
          ) : null}
          <input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            required={required}
            className={[
              CONTROL_BASE,
              'h-9',
              adornment ? 'pl-9' : '',
              invalid ? 'border-critical' : 'border-line',
              className,
            ].join(' ')}
            {...rest}
          />
        </div>
      )}
    </Field>
  );
}

export interface SelectInputProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  hint?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function SelectInput({
  label,
  hint,
  error,
  options,
  placeholder,
  required,
  className = '',
  ...rest
}: SelectInputProps) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          required={required}
          className={[
            CONTROL_BASE,
            'h-9 appearance-none bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-9',
            invalid ? 'border-critical' : 'border-line',
            className,
          ].join(' ')}
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a9096' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
          }}
          {...rest}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  hint?: string;
  error?: string;
}

export function TextArea({ label, hint, error, required, className = '', rows = 3, ...rest }: TextAreaProps) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          required={required}
          className={[
            CONTROL_BASE,
            'resize-y py-2 leading-relaxed',
            invalid ? 'border-critical' : 'border-line',
            className,
          ].join(' ')}
          {...rest}
        />
      )}
    </Field>
  );
}

/** Accessible switch used for binary preferences. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-base font-medium text-ink">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={[
          'focus-ring relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ease-swift',
          checked ? 'bg-accent' : 'bg-line-strong',
          disabled ? 'cursor-not-allowed opacity-60' : '',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-subtle transition-transform duration-200 ease-swift',
            checked ? 'translate-x-[1.125rem]' : 'translate-x-0.5',
          ].join(' ')}
        />
      </button>
    </div>
  );
}
