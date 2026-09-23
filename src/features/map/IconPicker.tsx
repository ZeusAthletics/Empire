"use client";

import { mapIconAssetUrl } from "@/lib/map-icon-assets";
import type { MapIconSetSummary } from "@/server/domain/map/types";

export function IconPicker({
  sets,
  value,
  disabled,
  onChange,
}: {
  sets: MapIconSetSummary[];
  value: string | null;
  disabled?: boolean;
  onChange: (iconKey: string | null) => void;
}) {
  if (!sets.length) {
    return (
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>
        Geen iconensets actief — vraag de admin.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {sets.map((set) => (
        <div key={set.slug}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            {set.title}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
              gap: 6,
              maxHeight: 220,
              overflowY: "auto",
              padding: 2,
            }}
          >
            <button
              type="button"
              className="chip"
              disabled={disabled}
              aria-pressed={!value}
              onClick={() => onChange(null)}
              style={{ gridColumn: "1 / -1", justifyContent: "center", opacity: value ? 0.7 : 1 }}
            >
              Standaard (type-pin)
            </button>
            {Array.from({ length: set.iconCount }, (_, index) => {
              const iconKey = `${set.slug}:${index}`;
              const selected = value === iconKey;
              return (
                <button
                  key={iconKey}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  title={iconKey}
                  onClick={() => onChange(iconKey)}
                  style={{
                    padding: 4,
                    borderRadius: 8,
                    border: selected ? "2px solid var(--gold)" : "1px solid var(--line)",
                    background: selected ? "rgba(201, 162, 39, 0.12)" : "var(--surface)",
                    cursor: disabled ? "default" : "pointer",
                  }}
                >
                  <img
                    src={mapIconAssetUrl(set.slug, index)}
                    alt=""
                    width={28}
                    height={28}
                    style={{ display: "block", width: "100%", height: "auto", objectFit: "contain" }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
