"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Tag } from "@/components/ui/Tag";
import { useEmpireUI } from "@/components/empire-ui-context";
import type { NyxTalkState } from "@/server/domain/nyx/types";

const SHORTCUTS = [
  "Wat moet ik vandaag doen?",
  "Waarom loopt Network achter?",
  "Geef me één high-impact move.",
];

export function NyxSheet() {
  const router = useRouter();
  const { closeSheet, toast } = useEmpireUI();
  const [talk, setTalk] = useState<NyxTalkState | null>(null);
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editXp, setEditXp] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadTalk();
  }, []);

  useEffect(() => {
    logRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
  }, [talk?.messages.length]);

  async function loadTalk() {
    const response = await fetch("/api/nyx/message");
    const data = (await response.json()) as { ok: boolean; talk?: NyxTalkState };
    if (response.ok && data.talk) setTalk(data.talk);
  }

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setPending(true);
    const response = await fetch("/api/nyx/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed }),
    });
    const data = (await response.json()) as { ok: boolean; talk?: NyxTalkState; error?: string };
    setPending(false);
    if (!response.ok || !data.ok || !data.talk) {
      toast(data.error ?? "Nyx kon niet antwoorden.");
      return;
    }
    setTalk(data.talk);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function accept(edits?: { title?: string; xp?: number }) {
    if (!talk?.proposal) return;
    setPending(true);
    const response = await fetch(`/api/nyx/proposals/${talk.proposal.id}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edits ?? {}),
    });
    const data = (await response.json()) as { ok: boolean; mission?: { title: string }; error?: string };
    setPending(false);
    if (!response.ok || !data.ok || !data.mission) {
      toast(data.error ?? "Voorstel kon niet worden aanvaard.");
      return;
    }
    closeSheet();
    toast(`Missie toegevoegd · ${data.mission.title}`);
    router.push("/missions");
    router.refresh();
  }

  async function ignore() {
    if (!talk?.proposal) return;
    setPending(true);
    const response = await fetch(`/api/nyx/proposals/${talk.proposal.id}/ignore`, { method: "POST" });
    const data = (await response.json()) as { ok: boolean; talk?: NyxTalkState; error?: string };
    setPending(false);
    if (!response.ok || !data.ok || !data.talk) {
      toast(data.error ?? "Voorstel kon niet worden genegeerd.");
      return;
    }
    setEditing(false);
    setTalk(data.talk);
    toast("Voorstel genegeerd");
  }

  async function remember(id: string) {
    setPending(true);
    const response = await fetch(`/api/nyx/memories/${id}/confirm`, { method: "POST" });
    const data = (await response.json()) as { ok: boolean; talk?: NyxTalkState; error?: string };
    setPending(false);
    if (!response.ok || !data.ok || !data.talk) {
      toast(data.error ?? "Kon dit niet onthouden.");
      return;
    }
    setTalk(data.talk);
    toast("Onthouden");
  }

  async function forget(id: string) {
    setPending(true);
    const response = await fetch(`/api/nyx/memories/${id}/reject`, { method: "POST" });
    const data = (await response.json()) as { ok: boolean; talk?: NyxTalkState; error?: string };
    setPending(false);
    if (!response.ok || !data.ok || !data.talk) {
      toast(data.error ?? "Kon dit niet weigeren.");
      return;
    }
    setTalk(data.talk);
    toast("Niet onthouden");
  }

  async function confirmPattern() {
    if (!talk?.pattern) return;
    setPending(true);
    const response = await fetch(`/api/nyx/patterns/${talk.pattern.id}/confirm`, { method: "POST" });
    const data = (await response.json()) as { ok: boolean; talk?: NyxTalkState; error?: string };
    setPending(false);
    if (!response.ok || !data.ok || !data.talk) {
      toast(data.error ?? "Patroon kon niet worden bevestigd.");
      return;
    }
    setTalk(data.talk);
    toast("Patroon bevestigd");
  }

  async function dismissPattern() {
    if (!talk?.pattern) return;
    setPending(true);
    const response = await fetch(`/api/nyx/patterns/${talk.pattern.id}/dismiss`, { method: "POST" });
    const data = (await response.json()) as { ok: boolean; talk?: NyxTalkState; error?: string };
    setPending(false);
    if (!response.ok || !data.ok || !data.talk) {
      toast(data.error ?? "Patroon kon niet worden genegeerd.");
      return;
    }
    setTalk(data.talk);
    toast("Patroon genegeerd");
  }

  async function acceptReview() {
    if (!talk?.review) return;
    setPending(true);
    const response = await fetch(`/api/nyx/reviews/${talk.review.id}/accept`, { method: "POST" });
    const data = (await response.json()) as { ok: boolean; talk?: NyxTalkState; error?: string };
    setPending(false);
    if (!response.ok || !data.ok || !data.talk) {
      toast(data.error ?? "Review kon niet worden aanvaard.");
      return;
    }
    setTalk(data.talk);
    toast("Bottleneck bijgewerkt · hoofdstuk blijft");
  }

  async function ignoreReview() {
    if (!talk?.review) return;
    setPending(true);
    const response = await fetch(`/api/nyx/reviews/${talk.review.id}/ignore`, { method: "POST" });
    const data = (await response.json()) as { ok: boolean; talk?: NyxTalkState; error?: string };
    setPending(false);
    if (!response.ok || !data.ok || !data.talk) {
      toast(data.error ?? "Review kon niet worden genegeerd.");
      return;
    }
    setTalk(data.talk);
    toast("Review genegeerd");
  }

  const proposal = talk?.proposal;
  const memoryChips = talk?.memoryChips ?? [];
  const pattern = talk?.pattern ?? null;
  const review = talk?.review ?? null;

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

        <div ref={logRef} className="stack" style={{ gap: 8, marginBottom: 12 }}>
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
              <span className={`eyebrow${message.role === "me" ? " muted" : ""}`}>{message.role === "me" ? "U" : "Nyx"}</span>
              <p className="body" style={{ margin: "5px 0 0", color: "var(--ink-1)" }}>
                {message.text}
              </p>
            </div>
          ))}
        </div>

        <div className="chiprow" style={{ padding: "0 0 12px" }}>
          {SHORTCUTS.map((item) => (
            <button key={item} className="chip" type="button" disabled={pending} onClick={() => void ask(item)}>
              {item}
            </button>
          ))}
        </div>

        {memoryChips.length > 0 ? (
          <div className="chiprow" style={{ padding: "0 0 12px" }}>
            {memoryChips.map((chip) => (
              <span key={chip.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <button
                  className="chip is-on"
                  type="button"
                  disabled={pending}
                  onClick={() => void remember(chip.id)}
                >
                  Onthouden · {chip.label}
                </button>
                <button
                  className="chip"
                  type="button"
                  disabled={pending}
                  aria-label="Niet onthouden"
                  onClick={() => void forget(chip.id)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}

        {pattern ? (
          <div className="card" style={{ borderColor: "rgba(201,163,78,.4)", marginBottom: 12 }}>
            <span className="eyebrow">Patroon</span>
            <h3 className="display d-md" style={{ margin: "7px 0 8px" }}>
              {pattern.title}
            </h3>
            <p className="body" style={{ margin: "0 0 11px", color: "var(--ink-2)" }}>
              {pattern.description}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-gold btn-sm" style={{ flex: 1 }} type="button" disabled={pending} onClick={() => void confirmPattern()}>
                Bevestig
              </button>
              <button className="btn btn-quiet btn-sm" type="button" disabled={pending} onClick={() => void dismissPattern()}>
                Ignore
              </button>
            </div>
          </div>
        ) : null}

        {review ? (
          <div className="card" style={{ borderColor: "rgba(201,163,78,.4)", marginBottom: 12 }}>
            <span className="eyebrow">Campagne-review</span>
            <h3 className="display d-md" style={{ margin: "7px 0 8px" }}>
              Bottleneck → {review.bottleneck}
            </h3>
            <p className="body" style={{ margin: "0 0 11px", color: "var(--ink-2)" }}>
              {review.whatStays}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-gold btn-sm" style={{ flex: 1 }} type="button" disabled={pending} onClick={() => void acceptReview()}>
                Accept
              </button>
              <button className="btn btn-quiet btn-sm" type="button" disabled={pending} onClick={() => void ignoreReview()}>
                Ignore
              </button>
            </div>
          </div>
        ) : null}

        {proposal ? (
          <div className="card" style={{ borderColor: "rgba(201,163,78,.4)" }}>
            <span className="eyebrow">Voorgestelde missie</span>
            {editing ? (
              <>
                <div className="field" style={{ marginTop: 10 }}>
                  <label htmlFor="sugTitle">Titel</label>
                  <input id="sugTitle" className="input" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="sugXp">XP</label>
                  <input id="sugXp" className="input" type="number" value={editXp} onChange={(event) => setEditXp(event.target.value)} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-quiet" type="button" onClick={() => setEditing(false)}>
                    Annuleer
                  </button>
                  <button
                    className="btn btn-gold"
                    style={{ flex: 1 }}
                    type="button"
                    disabled={pending}
                    onClick={() => void accept({ title: editTitle, xp: Number(editXp) })}
                  >
                    Bewaar en accepteer
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="display d-md" style={{ margin: "7px 0 8px" }}>
                  {proposal.title}
                </h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 11 }}>
                  <Tag className="alt">{proposal.duration}</Tag>
                  <Tag className="alt">{`Difficulty: ${proposal.difficulty}`}</Tag>
                  <Tag>{`+${proposal.xp} XP`}</Tag>
                  <Tag className="alt">{proposal.impact}</Tag>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-gold btn-sm" style={{ flex: 1 }} type="button" disabled={pending} onClick={() => void accept()}>
                    Accept
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setEditTitle(proposal.title);
                      setEditXp(String(proposal.xp));
                      setEditing(true);
                    }}
                  >
                    Edit
                  </button>
                  <button className="btn btn-quiet btn-sm" type="button" disabled={pending} onClick={() => void ignore()}>
                    Ignore
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="body">Geen open voorstellen. Vraag iets en ik maak er een missie van.</p>
        )}
      </div>
      <div className="sheet-foot">
        <div style={{ display: "flex", gap: 8 }}>
          <input
            ref={inputRef}
            className="input"
            placeholder="Vraag Nyx iets…"
            aria-label="Bericht aan Nyx"
            disabled={pending}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void ask(inputRef.current?.value ?? "");
              }
            }}
          />
          <button
            className="btn btn-gold btn-icon"
            type="button"
            aria-label="Versturen"
            disabled={pending}
            onClick={() => void ask(inputRef.current?.value ?? "")}
          >
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.6 12 20.4 3.6l-6.2 16.8-2.8-6.8z" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
