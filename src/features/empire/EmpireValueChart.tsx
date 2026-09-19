"use client";

import { formatEuro } from "@/lib/stats";

export function EmpireValueChart({
  values,
  compact = false,
}: {
  values: number[];
  compact?: boolean;
}) {
  const width = compact ? 120 : 320;
  const height = compact ? 34 : 148;
  const padX = compact ? 2 : 12;
  const padY = compact ? 4 : 18;
  const series = values.length ? values : [0];
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const pts = series.map((value, index) => {
    const x = padX + (series.length === 1 ? innerW / 2 : (index / (series.length - 1)) * innerW);
    const y = padY + innerH - ((value - min) / span) * innerH;
    return { x, y, value };
  });
  const line = pts.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${padX},${height - padY} ${line} ${pts.at(-1)?.x ?? padX},${height - padY}`;
  const falling = series.length > 1 && series[series.length - 1] < series[0];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: "100%", height: compact ? 34 : 148, display: "block" }}
      aria-hidden="true"
    >
      {!compact ? (
        <>
          <text x={padX} y={12} fill="var(--ink-3)" fontSize="9">
            {formatEuro(max)}
          </text>
          <text x={padX} y={height - 4} fill="var(--ink-3)" fontSize="9">
            {formatEuro(min)}
          </text>
        </>
      ) : null}
      <polygon points={area} fill={falling ? "rgba(240,82,82,.12)" : "rgba(201,163,78,.14)"} />
      <polyline
        fill="none"
        stroke={falling ? "var(--coral)" : "var(--gold)"}
        strokeWidth={compact ? 1.6 : 2}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={line}
      />
    </svg>
  );
}
