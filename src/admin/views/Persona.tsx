"use client";

import { useMemo, useState } from "react";
import { compilePersona, DEFAULT_PERSONA, type Persona } from "@/server/ai/prompts/persona";

const SLIDERS: { key: keyof Persona["voice"]; label: string }[] = [
  { key: "directness", label: "Directheid" },
  { key: "warmth", label: "Warmte" },
  { key: "dryness", label: "Droogte" },
  { key: "brevity", label: "Beknoptheid" },
  { key: "challenge", label: "Tegenspraak" },
  { key: "formality", label: "Formaliteit" },
];

const RULES: { key: keyof Persona["rules"]; label: string }[] = [
  { key: "noEmoji", label: "Geen emoji" },
  { key: "noExclamation", label: "Geen uitroeptekens" },
  { key: "noDefaultPraise", label: "Niet feliciteren" },
  { key: "noUnpromptedMissions", label: "Geen spontane missies" },
  { key: "markInference", label: "Markeer inferenties" },
  { key: "admitUnknown", label: "Geef onwetendheid toe" },
  { key: "maxOneQuestion", label: "Maximaal één vraag" },
];

export function PersonaView() {
  const [persona, setPersona] = useState<Persona>(DEFAULT_PERSONA);
  const compiled = useMemo(() => compilePersona(persona), [persona]);

  return (
    <>
      <div className="head">
        <h1 className="display" style={{ fontSize: 22 }}>Nyx — persona</h1>
        <span className="muted mono">persona@{persona.version} · live compile, geen LLM</span>
      </div>
      <div className="split">
        <div className="card">
          <span className="eyebrow">Stem</span>
          {SLIDERS.map((slider) => (
            <div key={slider.key} className="srow">
              <span className="lab">{slider.label}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={persona.voice[slider.key]}
                onChange={(event) =>
                  setPersona({
                    ...persona,
                    voice: { ...persona.voice, [slider.key]: Number(event.target.value) },
                  })
                }
              />
              <span className="val">{persona.voice[slider.key]}</span>
            </div>
          ))}
          <div style={{ marginTop: 16 }}>
            <span className="eyebrow">Regels</span>
            {RULES.map((rule) => (
              <div key={rule.key} className="swrow">
                <span style={{ flex: 1 }}>{rule.label}</span>
                <button
                  className="tag"
                  type="button"
                  aria-pressed={persona.rules[rule.key]}
                  onClick={() =>
                    setPersona({
                      ...persona,
                      rules: { ...persona.rules, [rule.key]: !persona.rules[rule.key] },
                    })
                  }
                >
                  {persona.rules[rule.key] ? "aan" : "uit"}
                </button>
              </div>
            ))}
          </div>
          <p className="muted" style={{ margin: "14px 0 0" }}>
            Aanspreekvorm: <b>{persona.address}</b>. Activeren vereist een geslaagde evalsuite.
          </p>
        </div>
        <div className="card gold">
          <div className="head" style={{ marginBottom: 8 }}>
            <span className="eyebrow">Compiled prompt</span>
            <span className="mono muted">{compiled.length} tekens</span>
          </div>
          <pre className="code">{compiled}</pre>
        </div>
      </div>
    </>
  );
}
