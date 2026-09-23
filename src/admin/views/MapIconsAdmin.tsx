"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { mapIconAssetUrl } from "@/lib/map-icon-assets";
import type { MapIconSet } from "@/server/domain/map/iconSets";

export function MapIconsAdminView({ sets: initialSets }: { sets: MapIconSet[] }) {
  const router = useRouter();
  const [sets, setSets] = useState(initialSets);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(slug: string, active: boolean) {
    setPending(slug);
    setError(null);
    try {
      const response = await fetch("/api/admin/map-icons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, active }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string; set?: MapIconSet };
      if (!response.ok || !data.ok || !data.set) {
        setError(data.error ?? "Opslaan mislukt.");
        return;
      }
      setSets((prev) => prev.map((item) => (item.slug === slug ? data.set! : item)));
      router.refresh();
    } catch {
      setError("Geen verbinding.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="memory-page">
      <div className="head">
        <h1 className="display" style={{ fontSize: 22 }}>
          Kaart — iconensets
        </h1>
        <span className="muted mono">Spelers kunnen alleen iconen uit actieve sets kiezen.</span>
      </div>

      <p className="memory-explainer">
        Deel 1 staat in <code>public/map-icons/part-1/</code> (100 iconen). Schakel sets uit om ze te verbergen in de
        kaart-picker; bestaande pin-keuzes vallen terug naar het standaard type-icoon.
      </p>

      {error ? <p style={{ color: "var(--coral)" }}>{error}</p> : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {sets.map((set) => (
          <div key={set.slug} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <div className="eyebrow">{set.slug}</div>
                <h2 className="display d-sm" style={{ margin: "6px 0 4px" }}>
                  {set.title}
                </h2>
                <p className="mono muted" style={{ margin: 0 }}>
                  {set.iconCount} iconen · {set.gridCols}×{set.gridRows}
                </p>
              </div>
              <button
                className={`btn sm ${set.active ? "gold" : ""}`}
                type="button"
                disabled={pending === set.slug}
                onClick={() => void toggle(set.slug, !set.active)}
              >
                {pending === set.slug ? "Bezig…" : set.active ? "Actief" : "Inactief — activeer"}
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
                gap: 4,
                marginTop: 14,
                maxHeight: 160,
                overflow: "hidden",
              }}
            >
              {Array.from({ length: Math.min(set.iconCount, 50) }, (_, index) => (
                <img
                  key={index}
                  src={mapIconAssetUrl(set.slug, index)}
                  alt=""
                  width={32}
                  height={32}
                  style={{ width: "100%", height: "auto", objectFit: "contain" }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
