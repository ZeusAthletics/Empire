"use client";

import { Calendar, ImageIcon, Mic, Send } from "lucide-react";
import { EmptyInvite } from "@/components/ui/EmptyInvite";
import { HeroArt } from "@/components/ui/HeroArt";
import { useEmpireUI } from "@/components/empire-ui-context";

const JFILTERS = [
  ["today", "Vandaag"],
  ["week", "Week"],
  ["month", "Maand"],
  ["all", "Alles"],
] as const;

export function JournalScreen() {
  const { toast } = useEmpireUI();
  const now = new Date();
  const DAYS = ["zo", "ma", "di", "wo", "do", "vr", "za"];
  const MONTHS = [
    "januari",
    "februari",
    "maart",
    "april",
    "mei",
    "juni",
    "juli",
    "augustus",
    "september",
    "oktober",
    "november",
    "december",
  ];
  const dateLabel = `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()].slice(0, 3)} ${now.getFullYear()}`;

  function notYet() {
    toast("Journal volgt in fase 6. Niets wordt lokaal bewaard.");
  }

  return (
    <>
      <header className="hero" style={{ paddingBottom: 14 }}>
        <HeroArt seed={3} />
        <div className="hero-corner">
          <span className="eyebrow">Discipline turns moments into outcomes</span>
        </div>
        <h1 className="display d-xl" style={{ margin: "16px 0 4px" }}>
          Journal
        </h1>
        <span className="eyebrow muted">Capture today. Build tomorrow.</span>
      </header>

      <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "12px 16px 0" }}>
        <div className="chiprow" style={{ padding: 0, flex: 1 }} aria-label="Periode">
          {JFILTERS.map(([key, label]) => (
            <button
              key={key}
              className="chip"
              type="button"
              aria-pressed={key === "today"}
              onClick={notYet}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px 0" }}>
        <span className="card flat" style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "9px 12px" }}>
          <span style={{ color: "var(--gold)" }}>
            <Calendar size={15} strokeWidth={2} />
          </span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{dateLabel}</span>
        </span>
      </div>

      <div className="section grid-2">
        <div className="card flat" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-caveat), Caveat, cursive",
              fontSize: 19,
              lineHeight: 1.25,
              color: "var(--ivory)",
            }}
          >
            “Small logs make big fires. Keep stacking the right ones.”
          </p>
          <span className="script" style={{ marginTop: 6, textAlign: "right" }}>
            Nyx
          </span>
        </div>
        <button
          className="btn btn-gold"
          style={{ height: "100%", flexDirection: "column", gap: 4, padding: "14px 10px" }}
          type="button"
          onClick={notYet}
        >
          Create wrap
          <span style={{ fontSize: 9, letterSpacing: "0.14em", opacity: 0.8 }}>Month so far · 0 entries</span>
        </button>
      </div>

      <div className="section">
        <EmptyInvite body="Nog niets gelogd voor deze periode. Schrijven kan wanneer Journal live gaat." />
      </div>

      <div className="section" style={{ textAlign: "center", margin: "18px 0 92px" }}>
        <span className="script" style={{ fontSize: 24 }}>
          Kempen Vice
        </span>
        <p className="eyebrow muted" style={{ margin: "2px 0 0" }}>
          Real opportunities. No fiction.
        </p>
      </div>

      <div className="composer">
        <button className="ic" type="button" aria-label="Beeld toevoegen" onClick={notYet}>
          <ImageIcon size={19} strokeWidth={1.9} />
        </button>
        <textarea rows={1} placeholder="Wat bewoog er vandaag?" aria-label="Quick note" disabled />
        <button className="ic" type="button" aria-label="Spraaknotitie" onClick={notYet}>
          <Mic size={19} strokeWidth={1.9} />
        </button>
        <button className="send" type="button" aria-label="Notitie opslaan" onClick={notYet}>
          <Send size={18} strokeWidth={2.1} />
        </button>
      </div>
    </>
  );
}
