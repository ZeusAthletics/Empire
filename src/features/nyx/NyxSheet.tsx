"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Paperclip, X } from "lucide-react";
import { Tag } from "@/components/ui/Tag";
import { useEmpireUI } from "@/components/empire-ui-context";
import type { NyxTalkState } from "@/server/domain/nyx/types";

const SHORTCUTS = [
  "Wat moet ik vandaag doen?",
  "Waarom loopt Network achter?",
  "Geef me één high-impact move.",
];

function playerTimeZoneHeaders(): HeadersInit {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz ? { "x-player-timezone": tz } : {};
  } catch {
    return {};
  }
}

export function NyxSheet() {
  const router = useRouter();
  const { closeSheet, toast } = useEmpireUI();
  const [talk, setTalk] = useState<NyxTalkState | null>(null);
  const [sending, setSending] = useState(false);
  const [booting, setBooting] = useState(true);
  const [pendingMedia, setPendingMedia] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editXp, setEditXp] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const sendAbortRef = useRef<AbortController | null>(null);
  const [attachMediaId, setAttachMediaId] = useState<string | null>(null);
  const [attachPreview, setAttachPreview] = useState<string | null>(null);
  const [attachName, setAttachName] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Composer lock only while a send is in flight — never while booting/recovering.
  const pending = sending;

  useEffect(() => {
    void loadTalk();
    return () => {
      sendAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    logRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
  }, [talk?.messages.length]);

  async function markNyxSeen() {
    await fetch("/api/nyx/seen", { method: "POST" }).catch(() => undefined);
    window.dispatchEvent(new Event("nyx-badge-refresh"));
  }

  async function loadTalk() {
    setBooting(true);
    setSending(false);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 70_000);
    try {
      const response = await fetch("/api/nyx/message", {
        headers: playerTimeZoneHeaders(),
        signal: controller.signal,
      });
      const data = (await response.json()) as { ok: boolean; talk?: NyxTalkState };
      if (response.ok && data.talk) {
        setTalk(data.talk);
        const last = data.talk.messages[data.talk.messages.length - 1];
        if (last?.role === "me") {
          // Auto-recover unanswered USER turns once the sheet opens.
          window.setTimeout(() => void retryDangling(true), 300);
        }
      }
      await markNyxSeen();
    } catch {
      toast("Nyx-gesprek kon niet laden.");
    } finally {
      window.clearTimeout(timeout);
      setBooting(false);
    }
  }

  const lastMessage = talk?.messages[talk.messages.length - 1] ?? null;
  const awaitingNyx = Boolean(lastMessage && lastMessage.role === "me");

  async function retryDangling(silent = false) {
    // Never no-op: abort any in-flight send and force a recover POST.
    sendAbortRef.current?.abort();
    setSending(true);
    setPendingMedia(false);
    toast(silent ? "Nyx pakt je laatste bericht op…" : "Nyx opnieuw proberen…");
    try {
      const response = await fetch("/api/nyx/message", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...playerTimeZoneHeaders() },
        body: JSON.stringify({ recover: true }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        talk?: NyxTalkState;
        error?: string;
        debug?: {
          danglingFound?: boolean;
          appended?: boolean;
          reason?: string;
          newestRole?: string | null;
        };
      };
      if (!response.ok || !data.ok || !data.talk) {
        toast(data.error ?? "Nyx kon de draad niet oppakken.");
        return;
      }
      setTalk(data.talk);
      await markNyxSeen();
      const last = data.talk.messages[data.talk.messages.length - 1];
      const stillWaiting = last?.role === "me";
      if (stillWaiting) {
        console.warn("[nyx recover]", data.debug);
        // Server sees no unanswered USER (UI/server mismatch) — force a real resend.
        if (data.debug?.reason === "no-dangling-user" && last.text.trim()) {
          toast("Geen open beurt op de server — ik stuur je laatste zin opnieuw.");
          setSending(false);
          await ask(last.text);
          return;
        }
        toast(
          data.debug?.reason
            ? `Geen reply (${data.debug.reason}${data.debug.newestRole ? ` · last=${data.debug.newestRole}` : ""}).`
            : "Nog geen antwoord — stuur je bericht opnieuw.",
        );
      }
    } catch {
      toast("Verbinding met Nyx mislukt.");
    } finally {
      setSending(false);
    }
  }

  function clearAttachment() {
    setAttachMediaId(null);
    setAttachPreview(null);
    setAttachName(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onPickFile(file: File | undefined) {
    if (!file || sending || uploading) return;
    setUploading(true);
    const body = new FormData();
    body.set("file", file);
    const response = await fetch("/api/nyx/attach", { method: "POST", body });
    const data = (await response.json()) as { ok: boolean; mediaId?: string; src?: string; error?: string };
    setUploading(false);
    if (!response.ok || !data.ok || !data.mediaId) {
      toast(data.error ?? "Upload mislukt.");
      return;
    }
    setAttachMediaId(data.mediaId);
    setAttachName(file.name);
    if (file.type.startsWith("image/")) setAttachPreview(data.src ?? null);
    else setAttachPreview(null);
  }

  async function ask(text: string) {
    const trimmed = text.trim();
    const url = linkUrl.trim();
    const mediaId = attachMediaId;
    if (!trimmed && !mediaId && !url) return;

    // Show the user bubble immediately — don't wait for a slow/hung reply.
    const optimisticId = `local-${Date.now()}`;
    const optimisticText = trimmed || (mediaId ? "(bijlage)" : url);
    const optimisticMsg = {
      id: optimisticId,
      role: "me" as const,
      text: optimisticText,
      mediaSrc: attachPreview,
      mediaKind: (attachPreview ? "image" : mediaId ? "file" : null) as "image" | "video" | "file" | null,
      linkedUrl: url || null,
    };
    setTalk((prev) => {
      const base = prev ?? {
        conversationId: "",
        messages: [],
        proposal: null,
        memoryChips: [],
        pattern: null,
        review: null,
      };
      return { ...base, messages: [...base.messages, optimisticMsg] };
    });
    if (inputRef.current) inputRef.current.value = "";
    const sentMediaId = mediaId;
    const sentUrl = url;
    clearAttachment();
    setLinkUrl("");
    setShowLink(false);

    sendAbortRef.current?.abort();
    const controller = new AbortController();
    sendAbortRef.current = controller;
    setSending(true);
    setPendingMedia(
      !sentMediaId && !sentUrl && /\b(foto|video|selfie|beeld|plaatje)\b|stuur.*(foto|video)/i.test(trimmed),
    );
    const timeout = window.setTimeout(() => controller.abort(), 90_000);
    try {
      const response = await fetch("/api/nyx/message", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...playerTimeZoneHeaders() },
        body: JSON.stringify({
          text: trimmed,
          mediaId: sentMediaId,
          linkedUrl: sentUrl || undefined,
        }),
        signal: controller.signal,
      });
      let data: { ok: boolean; talk?: NyxTalkState; error?: string } = { ok: false };
      try {
        data = (await response.json()) as { ok: boolean; talk?: NyxTalkState; error?: string };
      } catch {
        toast("Nyx gaf geen geldig antwoord. Probeer opnieuw.");
        return;
      }
      if (!response.ok || !data.ok || !data.talk) {
        toast(data.error ?? "Nyx kon niet antwoorden.");
        return;
      }
      setTalk(data.talk);
      await markNyxSeen();
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === "AbortError";
      toast(aborted ? "Nyx deed er te lang over. Probeer opnieuw." : "Verbinding met Nyx mislukt. Probeer opnieuw.");
    } finally {
      window.clearTimeout(timeout);
      if (sendAbortRef.current === controller) sendAbortRef.current = null;
      setSending(false);
      setPendingMedia(false);
    }
  }

  async function accept(edits?: { title?: string; xp?: number }) {
    if (!talk?.proposal) return;
    setSending(true);
    const response = await fetch(`/api/nyx/proposals/${talk.proposal.id}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edits ?? {}),
    });
    const data = (await response.json()) as { ok: boolean; mission?: { title: string }; error?: string };
    setSending(false);
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
    setSending(true);
    const response = await fetch(`/api/nyx/proposals/${talk.proposal.id}/ignore`, { method: "POST" });
    const data = (await response.json()) as { ok: boolean; talk?: NyxTalkState; error?: string };
    setSending(false);
    if (!response.ok || !data.ok || !data.talk) {
      toast(data.error ?? "Voorstel kon niet worden genegeerd.");
      return;
    }
    setEditing(false);
    setTalk(data.talk);
    toast("Voorstel genegeerd");
  }

  async function remember(id: string) {
    setSending(true);
    const response = await fetch(`/api/nyx/memories/${id}/confirm`, { method: "POST" });
    const data = (await response.json()) as { ok: boolean; talk?: NyxTalkState; error?: string };
    setSending(false);
    if (!response.ok || !data.ok || !data.talk) {
      toast(data.error ?? "Kon dit niet onthouden.");
      return;
    }
    setTalk(data.talk);
    toast("Onthouden");
  }

  async function forget(id: string) {
    setSending(true);
    const response = await fetch(`/api/nyx/memories/${id}/reject`, { method: "POST" });
    const data = (await response.json()) as { ok: boolean; talk?: NyxTalkState; error?: string };
    setSending(false);
    if (!response.ok || !data.ok || !data.talk) {
      toast(data.error ?? "Kon dit niet weigeren.");
      return;
    }
    setTalk(data.talk);
    toast("Niet onthouden");
  }

  async function confirmPattern() {
    if (!talk?.pattern) return;
    setSending(true);
    const response = await fetch(`/api/nyx/patterns/${talk.pattern.id}/confirm`, { method: "POST" });
    const data = (await response.json()) as { ok: boolean; talk?: NyxTalkState; error?: string };
    setSending(false);
    if (!response.ok || !data.ok || !data.talk) {
      toast(data.error ?? "Patroon kon niet worden bevestigd.");
      return;
    }
    setTalk(data.talk);
    toast("Patroon bevestigd");
  }

  async function dismissPattern() {
    if (!talk?.pattern) return;
    setSending(true);
    const response = await fetch(`/api/nyx/patterns/${talk.pattern.id}/dismiss`, { method: "POST" });
    const data = (await response.json()) as { ok: boolean; talk?: NyxTalkState; error?: string };
    setSending(false);
    if (!response.ok || !data.ok || !data.talk) {
      toast(data.error ?? "Patroon kon niet worden genegeerd.");
      return;
    }
    setTalk(data.talk);
    toast("Patroon genegeerd");
  }

  async function acceptReview() {
    if (!talk?.review) return;
    setSending(true);
    const response = await fetch(`/api/nyx/reviews/${talk.review.id}/accept`, { method: "POST" });
    const data = (await response.json()) as { ok: boolean; talk?: NyxTalkState; error?: string };
    setSending(false);
    if (!response.ok || !data.ok || !data.talk) {
      toast(data.error ?? "Review kon niet worden aanvaard.");
      return;
    }
    setTalk(data.talk);
    toast("Bottleneck bijgewerkt · hoofdstuk blijft");
  }

  async function ignoreReview() {
    if (!talk?.review) return;
    setSending(true);
    const response = await fetch(`/api/nyx/reviews/${talk.review.id}/ignore`, { method: "POST" });
    const data = (await response.json()) as { ok: boolean; talk?: NyxTalkState; error?: string };
    setSending(false);
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
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12, paddingRight: 36 }}>
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
              {message.linkedUrl ? (
                <a
                  href={message.linkedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono"
                  style={{ display: "block", marginTop: 6, fontSize: 11, color: "var(--gold-soft)", wordBreak: "break-all" }}
                >
                  {message.linkedUrl}
                </a>
              ) : null}
              {message.mediaSrc ? (
                message.mediaKind === "video" ? (
                  <video
                    src={message.mediaSrc}
                    controls
                    playsInline
                    preload="metadata"
                    style={{ width: "100%", marginTop: 8, borderRadius: 10 }}
                    onError={() => toast("Video kon niet laden — ververs de pagina of probeer opnieuw.")}
                  />
                ) : message.mediaKind === "file" ? (
                  <a
                    href={message.mediaSrc}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn sm"
                    style={{ marginTop: 8, display: "inline-block" }}
                  >
                    Open bijlage
                  </a>
                ) : (
                  <img
                    src={message.mediaSrc}
                    alt=""
                    style={{ width: "100%", marginTop: 8, borderRadius: 10, display: "block" }}
                    onError={() => toast("Foto kon niet laden — probeer opnieuw in te loggen of ververs de pagina.")}
                  />
                )
              ) : null}
            </div>
          ))}
        </div>

        {awaitingNyx ? (
          <div className="chiprow" style={{ padding: "0 0 12px" }}>
            <button className="chip is-on" type="button" onClick={() => void retryDangling(false)}>
              {sending ? "Nyx denkt na… (tik om te forceren)" : "Nyx antwoordt niet? Opnieuw proberen"}
            </button>
          </div>
        ) : null}

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
          <p className="body">
            {sending && pendingMedia
              ? "Nyx zoekt een foto of video — dit kan even duren…"
              : sending
                ? "Nyx denkt na…"
                : booting
                  ? "Gesprek laden…"
                  : "Geen open voorstellen. Vraag iets en ik maak er een missie van."}
          </p>
        )}
      </div>
      <div className="sheet-foot">
        {attachMediaId || attachName ? (
          <div
            className="card flat"
            style={{ marginBottom: 8, padding: 8, display: "flex", alignItems: "center", gap: 8 }}
          >
            {attachPreview ? (
              <img src={attachPreview} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }} />
            ) : (
              <span className="tag">Bijlage</span>
            )}
            <span className="mono muted" style={{ flex: 1, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis" }}>
              {attachName}
            </span>
            <button className="btn btn-quiet btn-icon" type="button" aria-label="Verwijder bijlage" onClick={clearAttachment}>
              <X size={16} />
            </button>
          </div>
        ) : null}
        {showLink ? (
          <input
            className="input"
            placeholder="https://…"
            aria-label="Website link"
            value={linkUrl}
            disabled={pending}
            onChange={(e) => setLinkUrl(e.target.value)}
            style={{ marginBottom: 8 }}
          />
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf,text/*,.txt,.md,.csv,.json"
          style={{ display: "none" }}
          onChange={(e) => void onPickFile(e.target.files?.[0])}
        />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            className="btn btn-quiet btn-icon"
            type="button"
            aria-label="Bestand uploaden"
            disabled={pending || uploading}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip size={18} strokeWidth={2.2} />
          </button>
          <button
            className="btn btn-quiet btn-icon"
            type="button"
            aria-label="Link toevoegen"
            disabled={pending}
            onClick={() => setShowLink((value) => !value)}
            style={showLink || linkUrl ? { color: "var(--gold)" } : undefined}
          >
            <Link2 size={18} strokeWidth={2.2} />
          </button>
          <input
            ref={inputRef}
            className="input"
            placeholder="Vraag Nyx iets… (optioneel bij bijlage/link)"
            aria-label="Bericht aan Nyx"
            disabled={pending || uploading}
            aria-busy={pending}
            style={{ flex: 1 }}
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
            disabled={pending || uploading}
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
