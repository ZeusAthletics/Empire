"use client";

import { useState } from "react";
import { IconPicker } from "@/features/map/IconPicker";
import type { MapIconSetSummary, MapPin } from "@/server/domain/map/types";

export function MapMarkerIconPanel({
  pin,
  iconSets,
  onSaved,
}: {
  pin: MapPin;
  iconSets: MapIconSetSummary[];
  onSaved: (iconKey: string | null, iconSrc: string | null) => void;
}) {
  const [choice, setChoice] = useState<string | null>(pin.iconKey);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/map/markers/icon", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markerKey: pin.id, iconKey: choice }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        error?: string;
        iconKey?: string | null;
        iconSrc?: string | null;
      };
      if (!response.ok || !data.ok) {
        setError(data.error ?? "Opslaan mislukt.");
        return;
      }
      onSaved(data.iconKey ?? null, data.iconSrc ?? null);
    } catch {
      setError("Geen verbinding.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="field" style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
      <label>Kaarticoon</label>
      <IconPicker sets={iconSets} value={choice} disabled={pending} onChange={setChoice} />
      {error ? (
        <p className="meta" style={{ color: "var(--coral)", margin: "8px 0 0" }}>
          {error}
        </p>
      ) : null}
      <button
        className="btn sm"
        type="button"
        style={{ marginTop: 10 }}
        disabled={pending || choice === pin.iconKey}
        onClick={() => void save()}
      >
        {pending ? "Bezig…" : "Icoon opslaan"}
      </button>
    </div>
  );
}
