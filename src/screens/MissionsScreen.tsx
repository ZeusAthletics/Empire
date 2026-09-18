"use client";

import { Check, Flag, Star, Target } from "lucide-react";
import { EmptyInvite } from "@/components/ui/EmptyInvite";
import { HeroArt } from "@/components/ui/HeroArt";
import { useEmpireUI } from "@/components/empire-ui-context";

const FILTERS = [
  { k: "active", label: "Active", icon: Target, count: 0 },
  { k: "main", label: "Main story", icon: Star, count: 0 },
  { k: "side", label: "Side quests", icon: Flag, count: 0 },
  { k: "done", label: "Completed", icon: Check, count: 0 },
] as const;

export function MissionsScreen() {
  const { openNyx } = useEmpireUI();

  return (
    <>
      <header className="hero">
        <HeroArt seed={2} />
        <div className="hero-corner">
          <span className="eyebrow">A better you builds a larger tomorrow</span>
        </div>
        <span className="eyebrow" style={{ display: "block", maxWidth: 90, lineHeight: 1.6 }}>
          Discipline builds freedom
        </span>
        <h1 className="display d-xl" style={{ margin: "26px 0 4px" }}>
          Missions
        </h1>
        <span className="eyebrow muted">Real opportunities. Real progress.</span>
        <div className="script" style={{ position: "absolute", right: 16, top: 96, textAlign: "right" }}>
          Execution
          <br />
          changes everything.
        </div>
      </header>

      <div className="chiprow" style={{ marginTop: 12 }} aria-label="Missiefilters">
        {FILTERS.map((filter) => (
          <button
            key={filter.k}
            className="chip"
            type="button"
            aria-pressed={filter.k === "active"}
          >
            <filter.icon size={14} strokeWidth={2} /> {filter.label}{" "}
            <span className="cnt">{filter.count}</span>
          </button>
        ))}
      </div>

      <div className="section">
        <EmptyInvite
          eyebrow="Current mission"
          body="Nog geen actieve missie. Nyx maakt er een wanneer voorstellen bestaan."
          action={
            <button className="btn btn-ghost btn-sm" type="button" onClick={openNyx}>
              Vraag het aan Nyx
            </button>
          }
        />
      </div>

      <div className="section">
        <div className="section-head">
          <h2 className="display d-sm">Active missions</h2>
        </div>
        <EmptyInvite body="Nog niets in deze lijst. Vraag Nyx om een missie of wacht tot er een voorstel klaarstaat." />
      </div>

      <div className="section">
        <div className="section-head">
          <h2 className="display d-sm">Suggested missions</h2>
        </div>
        <EmptyInvite
          body="Geen open voorstellen."
          action={
            <button className="btn btn-ghost btn-sm" type="button" onClick={openNyx}>
              Open Nyx
            </button>
          }
        />
      </div>
    </>
  );
}
