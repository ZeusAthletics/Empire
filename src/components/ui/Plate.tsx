"use client";

import { useId } from "react";

const PLATE_ART = {
  gym: ["#241A12", "#3B2A18", "M6 30h12M22 30h12M12 22v16M28 22v16"],
  note: ["#1B1814", "#2E2A21", "M8 14h26M8 22h20M8 30h24M8 38h14"],
  meet: ["#1E1610", "#3A2716", "M10 34c0-6 4-9 9-9s9 3 9 9M19 14a5 5 0 1 0 .1 0M32 34c0-5 3-8 7-8"],
  city: ["#1A1209", "#4A2A12", "M4 40V26h8v14M14 40V18h9v22M25 40V10h7v30M34 40V22h8v18"],
  room: ["#1C1815", "#332B21", "M6 38V18l18-8 18 8v20M18 38V26h12v12"],
  book: ["#171310", "#2B2218", "M10 12h12v26H10zM26 12h12v26H26zM13 18h6M29 18h6"],
  mission: ["#1A130C", "#553017", "M24 8a16 16 0 1 0 .1 0M24 18a6 6 0 1 0 .1 0M24 2v6M24 40v6M2 24h6M40 24h6"],
} as const;

export type PlateKind = keyof typeof PLATE_ART;

export function Plate({
  kind,
  className = "",
  label,
}: {
  kind: PlateKind;
  className?: string;
  label?: string;
}) {
  const id = useId().replace(/:/g, "");
  const [a, b, d] = PLATE_ART[kind];

  return (
    <div className={`plate ${className}`.trim()}>
      <svg viewBox="0 0 48 48" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={a} />
            <stop offset="1" stopColor={b} />
          </linearGradient>
        </defs>
        <rect width="48" height="48" fill={`url(#${id})`} />
        <path
          d={d}
          fill="none"
          stroke="rgba(201,163,78,.45)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label ? <span className="lbl">{label}</span> : null}
    </div>
  );
}
