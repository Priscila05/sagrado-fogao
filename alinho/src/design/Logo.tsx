/**
 * ALINHO's mark: a diamond outline holding a smaller, perfectly centred
 * diamond — alignment (concentric geometry), organisation (closed shape) and
 * progress (the inner form advancing toward the outer edge).
 */
export function LogoMark({
  className = 'h-6 w-6',
  tone = 'accent',
}: {
  className?: string;
  tone?: 'accent' | 'ink' | 'inverse';
}) {
  const stroke =
    tone === 'accent'
      ? 'rgb(var(--c-accent))'
      : tone === 'inverse'
        ? 'rgb(var(--c-accent-on))'
        : 'rgb(var(--c-ink))';

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-label="ALINHO"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 1.9 22.1 12 12 22.1 1.9 12 12 1.9Z"
        stroke={stroke}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M12 7.4 16.6 12 12 16.6 7.4 12 12 7.4Z" fill={stroke} />
    </svg>
  );
}

export function LogoLockup({
  className = '',
  showSlogan = false,
}: {
  className?: string;
  showSlogan?: boolean;
}) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark className="h-[22px] w-[22px] shrink-0" />
      <span className="flex min-w-0 flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-[0.14em] text-ink">ALINHO</span>
        {showSlogan ? (
          <span className="mt-1 text-2xs font-medium tracking-[0.02em] text-subtle">
            Nenhuma oportunidade esquecida
          </span>
        ) : null}
      </span>
    </span>
  );
}
