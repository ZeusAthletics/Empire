"use client";

import { Building2, Calendar, Filter, Layers, MapPin, Search, Target, Users } from "lucide-react";
import { EmptyInvite } from "@/components/ui/EmptyInvite";
import { useEmpireUI } from "@/components/empire-ui-context";

const MAP_FILTERS = [
  { k: "all", label: "Alles", icon: Layers },
  { k: "missions", label: "Missies", icon: Target },
  { k: "contacts", label: "Contacten", icon: Users },
  { k: "companies", label: "Bedrijven", icon: Building2 },
  { k: "events", label: "Events", icon: Calendar },
  { k: "mine", label: "Mijn pins", icon: MapPin },
] as const;

export function MapScreen() {
  const { openNyx, toast } = useEmpireUI();

  return (
    <>
      <header style={{ padding: "14px 16px 10px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h1 className="display d-lg">
              Kempen <span style={{ color: "var(--gold)" }}>Vice</span>
            </h1>
            <span className="eyebrow muted">Real opportunities. No fiction.</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 12px",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-pill)",
              background: "rgba(0,0,0,.35)",
            }}
          >
            <span style={{ color: "var(--ink-3)" }}>
              <Search size={16} strokeWidth={2} />
            </span>
            <input
              className="input"
              style={{ border: 0, background: "none", padding: "10px 0" }}
              placeholder="Zoek locatie, persoon, bedrijf…"
              aria-label="Zoek op de kaart"
              disabled
            />
          </div>
          <button
            className="btn btn-ghost btn-icon"
            type="button"
            aria-label="Filters"
            onClick={() => toast("Kaartfilters volgen in fase 5.")}
          >
            <Filter size={18} strokeWidth={2} />
          </button>
        </div>
      </header>

      <div className="chiprow" aria-label="Kaartfilters">
        {MAP_FILTERS.map((filter) => (
          <button
            key={filter.k}
            className="chip"
            type="button"
            aria-pressed={filter.k === "all"}
            onClick={() => toast("De kaart volgt. Pins komen uit de database.")}
          >
            <filter.icon size={14} strokeWidth={2} /> {filter.label}
          </button>
        ))}
      </div>

      <div className="mapwrap" style={{ marginTop: 10 }}>
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(80% 50% at 50% 40%, rgba(201,163,78,.12), transparent 70%), linear-gradient(180deg, #1a140e, #0e0c0a)",
          }}
        />
        <div className="map-hint">Kaart volgt in fase 5 · pins uit de database</div>
      </div>

      <div className="section" style={{ marginTop: 12 }}>
        <button className="btn btn-gold btn-block" type="button" onClick={() => toast("Eigen pins volgen in fase 5.")}>
          <MapPin size={15} strokeWidth={2.2} /> Eigen pin toevoegen
        </button>
      </div>

      <div className="section">
        <div className="section-head">
          <h2 className="display d-sm">Doelwitten in beeld</h2>
          <span className="eyebrow muted">0 markers</span>
        </div>
        <EmptyInvite
          body="Nog geen pins. De kaart praat met de database, niet met deze browser."
          action={
            <button className="btn btn-ghost btn-sm" type="button" onClick={openNyx}>
              Vraag het aan Nyx
            </button>
          }
        />
      </div>
    </>
  );
}
