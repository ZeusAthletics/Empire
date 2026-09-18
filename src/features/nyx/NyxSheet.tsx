"use client";

/* eslint-disable @next/next/no-img-element */

import { X } from "lucide-react";
import { useEmpireUI } from "@/components/empire-ui-context";

const SHORTCUTS = [
  "Wat moet ik vandaag doen?",
  "Waarom loopt Network achter?",
  "Geef me één high-impact move.",
];

export function NyxSheet() {
  const { closeSheet, toast } = useEmpireUI();

  function notYet() {
    toast("Nyx is er. Praten volgt later.");
  }

  return (
    <>
      <div className="sheet-body">
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
          <img
            src="/nyx.jpg"
            alt=""
            style={{
              width: 46,
              height: 46,
              borderRadius: "50%",
              objectFit: "cover",
              boxShadow: "0 0 0 2px var(--gold)",
            }}
          />
          <div>
            <h2 className="display d-md" style={{ margin: 0 }}>
              Nyx
            </h2>
            <span className="eyebrow muted">Mission control · altijd aan je zijde</span>
          </div>
          <button
            className="btn btn-ghost btn-icon"
            style={{ marginLeft: "auto" }}
            type="button"
            aria-label="Sluiten"
            onClick={closeSheet}
          >
            <X size={17} strokeWidth={2.2} />
          </button>
        </div>

        <div className="stack" style={{ gap: 8, marginBottom: 12 }}>
          <div className="card flat" style={{ padding: 11, marginRight: 24 }}>
            <span className="eyebrow">Nyx</span>
            <p className="body" style={{ margin: "5px 0 0", color: "var(--ink-1)" }}>
              Ik ben er. Nog niet in gesprek — dat komt wanneer ik écht mag spreken.
            </p>
          </div>
        </div>

        <div className="chiprow" style={{ padding: "0 0 12px" }}>
          {SHORTCUTS.map((item) => (
            <button key={item} className="chip" type="button" onClick={notYet}>
              {item}
            </button>
          ))}
        </div>

        <p className="body">Geen open voorstellen. Vraag iets wanneer Nyx live gaat.</p>
      </div>
      <div className="sheet-foot">
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            placeholder="Vraag Nyx iets…"
            aria-label="Bericht aan Nyx"
            disabled
          />
          <button className="btn btn-gold btn-icon" type="button" aria-label="Versturen" onClick={notYet}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.6 12 20.4 3.6l-6.2 16.8-2.8-6.8z" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
