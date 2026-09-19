"use client";

import { useState } from "react";

export function EvalButton() {
  const [label, setLabel] = useState("Evals draaien");
  const [pending, setPending] = useState(false);

  async function run() {
    setPending(true);
    setLabel("Evalsuite draait…");
    try {
      const response = await fetch("/api/admin/evals");
      const payload = (await response.json()) as { ok: boolean; passed?: number; total?: number };
      if (payload.ok) {
        setLabel(`${payload.passed}/${payload.total} geslaagd`);
      } else {
        setLabel("Evals gefaald");
      }
    } catch {
      setLabel("Evals onbereikbaar");
    } finally {
      setPending(false);
    }
  }

  return (
    <button className="btn gold" type="button" disabled={pending} onClick={() => void run()}>
      {label}
    </button>
  );
}
