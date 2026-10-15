export interface ColumnSeries {
  key: string;
  label: string;
  className: string;
}

export interface ColumnDatum {
  label: string;
  values: Record<string, number>;
}

/**
 * Grouped columns for period comparisons. Built with flex boxes so labels stay
 * crisp and every bar carries its own accessible title.
 */
export function ColumnChart({
  data,
  series,
  height = 180,
  emptyLabel = 'Sem dados suficientes para o período.',
}: {
  data: ColumnDatum[];
  series: ColumnSeries[];
  height?: number;
  emptyLabel?: string;
}) {
  const max = Math.max(
    1,
    ...data.flatMap((datum) => series.map((item) => datum.values[item.key] ?? 0)),
  );
  const hasValues = data.some((datum) => series.some((item) => (datum.values[item.key] ?? 0) > 0));

  if (!hasValues) {
    return <p className="py-10 text-center text-sm text-muted">{emptyLabel}</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pb-3">
        {series.map((item) => (
          <span key={item.key} className="flex items-center gap-1.5 text-xs text-muted">
            <span className={`h-2 w-2 rounded-sm ${item.className}`} aria-hidden="true" />
            {item.label}
          </span>
        ))}
      </div>
      <div className="relative" style={{ height }}>
        <div className="absolute inset-0 flex flex-col justify-between" aria-hidden="true">
          {[0, 1, 2, 3].map((index) => (
            <span key={index} className="border-t border-line/70" />
          ))}
        </div>
        <div
          className="relative flex h-full items-end gap-1.5 overflow-x-auto scrollbar-none"
          role="img"
          aria-label={`Comparativo por período: ${data
            .map(
              (datum) =>
                `${datum.label} — ${series
                  .map((item) => `${item.label} ${datum.values[item.key] ?? 0}`)
                  .join(', ')}`,
            )
            .join('; ')}`}
        >
          {data.map((datum) => (
            <div key={datum.label} className="flex h-full min-w-[2.5rem] max-w-[7rem] flex-1 flex-col justify-end">
              <div className="flex h-full items-end justify-center gap-[4px]">
                {series.map((item) => {
                  const value = datum.values[item.key] ?? 0;
                  return (
                    <div
                      key={item.key}
                      title={`${datum.label} · ${item.label}: ${value}`}
                      className={`w-full max-w-[22px] rounded-t-sm transition-[height] duration-500 ease-swift ${item.className}`}
                      style={{ height: value > 0 ? `${Math.max(3, (value / max) * 100)}%` : '2px' }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="relative mt-2 flex gap-1.5 overflow-x-auto scrollbar-none">
        {data.map((datum) => (
          <span
            key={datum.label}
            className="min-w-[2.5rem] max-w-[7rem] flex-1 text-center text-2xs text-subtle"
          >
            {datum.label}
          </span>
        ))}
      </div>
    </div>
  );
}
