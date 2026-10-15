import { useId, useMemo } from 'react';

export interface TrendPoint {
  label: string;
  value: number;
}

/**
 * Compact area/line trend. The path is drawn in a stretched viewBox with a
 * non-scaling stroke, so it stays crisp at any width while the labels are
 * plain HTML (never distorted).
 */
export function AreaTrend({
  points,
  height = 132,
  caption,
  valueSuffix = '',
}: {
  points: TrendPoint[];
  height?: number;
  caption?: string;
  valueSuffix?: string;
}) {
  const gradientId = useId();
  const max = Math.max(1, ...points.map((point) => point.value));

  const { linePath, areaPath } = useMemo(() => {
    if (points.length === 0) return { linePath: '', areaPath: '' };
    const step = points.length > 1 ? 100 / (points.length - 1) : 0;
    const coords = points.map((point, index) => {
      const x = points.length > 1 ? index * step : 50;
      const y = 100 - (point.value / max) * 92 - 4;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    const line = `M${coords.join(' L')}`;
    const area = `${line} L100,100 L0,100 Z`;
    return { linePath: line, areaPath: area };
  }, [points, max]);

  const labelIndexes = useMemo(() => {
    if (points.length <= 1) return [0];
    if (points.length <= 6) return points.map((_, index) => index);
    return [0, Math.floor((points.length - 1) / 2), points.length - 1];
  }, [points]);

  const total = points.reduce((sum, point) => sum + point.value, 0);

  return (
    <figure className="m-0">
      <div className="relative" style={{ height }}>
        {/* Horizontal guides */}
        <div className="absolute inset-0 flex flex-col justify-between" aria-hidden="true">
          {[0, 1, 2, 3].map((index) => (
            <span key={index} className="border-t border-line/70" />
          ))}
        </div>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="relative h-full w-full"
          role="img"
          aria-label={caption ?? 'Gráfico de evolução'}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--c-accent))" stopOpacity="0.16" />
              <stop offset="100%" stopColor="rgb(var(--c-accent))" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {total > 0 ? (
            <>
              <path d={areaPath} fill={`url(#${gradientId})`} />
              <path
                d={linePath}
                fill="none"
                stroke="rgb(var(--c-accent))"
                strokeWidth="1.6"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </>
          ) : (
            <line
              x1="0"
              y1="96"
              x2="100"
              y2="96"
              stroke="rgb(var(--c-line-strong))"
              strokeWidth="1"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      </div>
      <div className="mt-2 flex justify-between text-2xs text-subtle tnum">
        {labelIndexes.map((index) => (
          <span key={index}>{points[index]?.label}</span>
        ))}
      </div>
      {/* Accessible equivalent of the drawing */}
      <figcaption className="sr-only">
        {caption ? `${caption}. ` : ''}
        {points
          .map((point) => `${point.label}: ${point.value}${valueSuffix}`)
          .join('; ')}
      </figcaption>
    </figure>
  );
}
