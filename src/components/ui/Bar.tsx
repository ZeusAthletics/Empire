"use client";

import { useEffect, useState } from "react";

export function Bar({ pct, className = "" }: { pct: number; className?: string }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setWidth(Math.max(0, Math.min(100, pct)));
    });
    return () => cancelAnimationFrame(frame);
  }, [pct]);

  return (
    <div className={`bar ${className}`.trim()}>
      <i style={{ width: `${width}%` }} />
    </div>
  );
}
