"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import type { IntakeTalkState } from "@/server/ai/services/IntakeConversationService";

export function IntakeScreen() {
  const router = useRouter();
  const [talk, setTalk] = useState<IntakeTalkState | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadTalk();
  }, []);

  useEffect(() => {
    logRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
  }, [talk?.messages.length]);

  async function loadTalk() {
    const response = await fetch("/api/nyx/intake");
    const data = (await response.json()) as { ok: boolean; talk?: IntakeTalkState; error?: string };
    if (response.ok && data.talk) setTalk(data.talk);
    else setError(data.error ?? "Intake kon niet starten.");
  }

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setPending(true);
    setError(null);
    const response = await fetch("/api/nyx/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed }),
    });
    const data = (await response.json()) as { ok: boolean; talk?: IntakeTalkState; error?: string };
    setPending(false);
    if (!response.ok || !data.ok || !data.talk) {
      setError(data.error ?? "Nyx kon niet antwoorden.");
      return;
    }
    setTalk(data.talk);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function confirm() {
    if (pending) return;
    setPending(true);
    setError(null);
    const response = await fetch("/api/nyx/intake/confirm", { method: "POST" });
    const data = (await response.json()) as { ok: boolean; next?: string; error?: string };
    setPending(false);
    if (!response.ok || !data.ok) {
      setError(data.error ?? "Intake kon niet worden bevestigd.");
      return;
    }
    router.push(data.next ?? "/home");
    router.refresh();
  }

  const slots = talk?.slots ?? { personal: false, business: false, goals: false };

  return (
    <div className="app intake">
      <main className="view" style={{ paddingBottom: "calc(28px + var(--safe-b))" }}>
        <header className="hero" style={{ paddingBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
              <span className="eyebrow">Nyx · intake</span>
              <h1 className="display d-md" style={{ margin: "4px 0 0" }}>
                Wie bent u
              </h1>
            </div>
          </div>
          <p className="body" style={{ margin: "12px 0 0", maxWidth: "22rem" }}>
            Drie dingen. Daarna kan ik missies maken die bij u horen.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <SlotChip done={slots.personal} label="Persoon" />
            <SlotChip done={slots.business} label="Zaak" />
            <SlotChip done={slots.goals} label="Doel" />
          </div>
        </header>

        <div ref={logRef} className="section stack" style={{ marginTop: 0 }}>
          {(talk?.messages ?? []).map((message) => (
            <div
              key={message.id}
              className="card flat"
              style={{
                padding: 11,
                ...(message.role === "me"
                  ? { background: "rgba(201,163,78,.12)", borderColor: "rgba(201,163,78,.3)", marginLeft: 32 }
                  : { marginRight: 24 }),
              }}
            >
              <span className={`eyebrow${message.role === "me" ? " muted" : ""}`}>
                {message.role === "me" ? "U" : "Nyx"}
              </span>
              <p className="body" style={{ margin: "5px 0 0", color: "var(--ink-1)" }}>
                {message.text}
              </p>
            </div>
          ))}
        </div>

        {error ? (
          <div className="section">
            <p className="body" style={{ color: "var(--coral)", margin: 0 }}>
              {error}
            </p>
          </div>
        ) : null}

        {talk?.readyToConfirm ? (
          <div className="section">
            <button className="btn btn-gold btn-block" type="button" disabled={pending} onClick={() => void confirm()}>
              {pending ? "Bezig…" : "Dit klopt · start het empire"}
            </button>
          </div>
        ) : null}

        <form
          className="section"
          onSubmit={(event) => {
            event.preventDefault();
            void ask(inputRef.current?.value ?? "");
          }}
        >
          <div className="field">
            <label htmlFor="intakeReply">Uw antwoord</label>
            <input
              ref={inputRef}
              id="intakeReply"
              className="input"
              placeholder="Typ hier…"
              disabled={pending}
              autoComplete="off"
            />
          </div>
          <button className="btn btn-gold btn-block" type="submit" disabled={pending}>
            {pending ? "Nyx luistert…" : "Stuur"}
          </button>
        </form>
      </main>
    </div>
  );
}

function SlotChip({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      className="eyebrow"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid var(--line)",
        color: done ? "var(--gold)" : "var(--ink-3)",
      }}
    >
      {done ? <Check size={12} strokeWidth={2.4} /> : null}
      {label}
    </span>
  );
}
