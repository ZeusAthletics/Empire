"use client";

import { useState } from "react";

export function CampaignActions() {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function call(path: string, label: string) {
    setBusy(label);
    setMessage(null);
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const body = (await response.json()) as { ok?: boolean; error?: string };
      setMessage(body.ok ? `${label} gestart.` : body.error ?? "Mislukt.");
    } catch {
      setMessage("Netwerkfout.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <span className="eyebrow">Campaign Director</span>
      <div className="chiprow" style={{ marginTop: 10 }}>
        <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => call("/api/admin/campaign/progress", "Progression")}>
          {busy === "Progression" ? "Bezig…" : "Force progression"}
        </button>
        <button type="button" className="btn gold" disabled={Boolean(busy)} onClick={() => call("/api/admin/campaign/replan-chapter", "Replan")}>
          {busy === "Replan" ? "Bezig…" : "Replan hoofdstuk in place"}
        </button>
      </div>
      {message ? <div className="mono muted" style={{ marginTop: 8 }}>{message}</div> : null}
    </div>
  );
}
