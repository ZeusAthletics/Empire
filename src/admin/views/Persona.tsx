"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

export function PersonaView({
  initialPrompt,
  initialVersion,
}: {
  initialPrompt: string;
  initialVersion: number;
}) {
  const router = useRouter();
  const [persona, setPersona] = useState<Persona>(DEFAULT_PERSONA);
  const compiled = useMemo(() => compilePersona(persona), [persona]);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [dirty, setDirty] = useState(initialPrompt.trim() !== compilePersona(DEFAULT_PERSONA).trim());
  const [version, setVersion] = useState(initialVersion);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) setPrompt(compiled);
  }, [compiled, dirty]);

  async function save() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ compiledPrompt: prompt, address: persona.address }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        persona?: { version: number; compiledPrompt: string };
      };
      if (!response.ok || !payload.ok || !payload.persona) {
        setError(payload.error ?? "Opslaan mislukt. Plak eerst de Phase 11 SQL als de tabel ontbreekt.");
        return;
      }
      setVersion(payload.persona.version);
      setDirty(true);
      setMessage("Opgeslagen. Nyx gebruikt dit karakter vanaf het volgende bericht.");
      router.refresh();
    } catch {
      setError("Geen verbinding.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="head">
        <h1 className="display" style={{ fontSize: 22 }}>Nyx — persona</h1>
        <span className="muted mono">actief persona@{version}</span>
      </div>
      <div className="split persona-split">
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
            Aanspreekvorm: <b>{persona.address}</b>. De schuifregelaars vullen het prompt alleen als u nog niet zelf hebt geschreven.
          </p>
        </div>
        <div className="card gold">
          <div className="head" style={{ marginBottom: 8 }}>
            <span className="eyebrow">Compiled prompt</span>
            <span className="mono muted">{prompt.length} tekens</span>
          </div>
          <p className="muted" style={{ margin: "0 0 10px" }}>
            Dit is wie Nyx is. Plak of schrijf haar uitgebreide persoonlijkheid. Opslaan maakt dit het actieve karakter van de bot.
          </p>
          <textarea
            className="code prompt-editor"
            value={prompt}
            spellCheck={false}
            onChange={(event) => {
              setPrompt(event.target.value);
              setDirty(true);
            }}
          />
          <div className="actions" style={{ marginTop: 12 }}>
            <button
              className="btn sm"
              type="button"
              onClick={() => {
                setPrompt(compiled);
                setDirty(false);
                setMessage(null);
              }}
            >
              Vul vanuit stem
            </button>
            <button className="btn gold" type="button" disabled={pending || prompt.trim().length < 40} onClick={() => void save()}>
              {pending ? "Bewaren…" : "Opslaan"}
            </button>
          </div>
          {message ? <p className="up" style={{ margin: "10px 0 0" }}>{message}</p> : null}
          {error ? <p className="down" style={{ margin: "10px 0 0" }}>{error}</p> : null}
        </div>
      </div>
    </>
  );
}
