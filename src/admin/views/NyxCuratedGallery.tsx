"use client";

/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { relTime } from "@/admin/format";
import { INTIMACY_TIER_LABELS } from "@/server/domain/nyx/curated/tier";
import type { NyxCuratedItem } from "@/server/domain/nyx/curated/repository";
import type { IntimacyTier } from "@/server/domain/nyx/outreach/intimacy";

const TIERS: IntimacyTier[] = ["EARLY", "FRIEND", "TRUST"];

export function NyxCuratedGalleryView({
  items,
  scopedName,
}: {
  items: NyxCuratedItem[];
  scopedName: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [label, setLabel] = useState("");
  const [minTier, setMinTier] = useState<IntimacyTier>("EARLY");

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!description.trim()) {
      setError("Vul eerst een beschrijving in (voor Nyx AI).");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("description", description);
      body.append("minIntimacyTier", minTier);
      if (label.trim()) body.append("label", label);
      const response = await fetch("/api/admin/nyx-curated", { method: "POST", body });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Upload mislukt.");
        return;
      }
      setDescription("");
      setLabel("");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch {
      setError("Geen verbinding.");
    } finally {
      setPending(false);
    }
  }

  async function saveItem(item: NyxCuratedItem, patch: { description: string; minIntimacyTier: IntimacyTier }) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/nyx-curated", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, description: patch.description, minIntimacyTier: patch.minIntimacyTier }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Opslaan mislukt.");
        return;
      }
      router.refresh();
    } catch {
      setError("Geen verbinding.");
    } finally {
      setPending(false);
    }
  }

  async function removeItem(id: string) {
    if (!window.confirm("Curated item verwijderen? Al verstuurd blijft in spelergeschiedenis.")) return;
    setPending(true);
    await fetch(`/api/admin/nyx-curated?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    router.refresh();
    setPending(false);
  }

  return (
    <>
      <div className="head">
        <h1 className="display" style={{ fontSize: 22 }}>
          Nyx — curated galerij
        </h1>
        <span className="muted">
          OpenArt stills/clips · AI kiest op beschrijving + band · elk item max 1× naar {scopedName}
        </span>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="eyebrow">Upload</div>
        <p className="muted" style={{ margin: "8px 0 12px", fontSize: 12.5 }}>
          Beschrijf kort wat er op staat en wanneer Nyx dit mag sturen (hook, sfeer). Min. band = intimacy tier.
        </p>
        <label className="field" style={{ display: "block", marginBottom: 10 }}>
          <span className="eyebrow">Beschrijving voor AI</span>
          <textarea
            className="input"
            rows={3}
            disabled={pending}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Bijv. close-up glimlach, goud latex, Kempen regen — past na zware training of compliment op doorzettingsvermogen."
            style={{ width: "100%", maxWidth: 720, marginTop: 6, resize: "vertical" }}
          />
        </label>
        <label className="field" style={{ display: "block", marginBottom: 10, maxWidth: 360 }}>
          <span className="eyebrow">Min. band</span>
          <select
            className="input"
            value={minTier}
            disabled={pending}
            onChange={(e) => setMinTier(e.target.value as IntimacyTier)}
            style={{ marginTop: 6, width: "100%" }}
          >
            {TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {INTIMACY_TIER_LABELS[tier]}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ display: "block", marginBottom: 12, maxWidth: 360 }}>
          <span className="eyebrow">Label (optioneel)</span>
          <input
            className="input"
            disabled={pending}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={{ marginTop: 6, width: "100%" }}
          />
        </label>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/mp4,video/webm"
          disabled={pending}
          style={{ display: "none" }}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <button className="btn gold sm" type="button" disabled={pending} onClick={() => inputRef.current?.click()}>
          {pending ? "Bezig…" : "Kies foto of video"}
        </button>
        {error ? <p style={{ color: "var(--coral)", marginTop: 10 }}>{error}</p> : null}
      </div>

      <div className="agrid" style={{ marginTop: 14 }}>
        {items.map((item) => (
          <CuratedCard key={item.id} item={item} pending={pending} onSave={saveItem} onRemove={removeItem} />
        ))}
      </div>
      {!items.length ? (
        <div className="empty" style={{ marginTop: 14 }}>
          Nog geen curated items. Nyx kan alleen GENERATE tot je hier OpenArt uploads plaatst.
        </div>
      ) : null}
    </>
  );
}

function CuratedCard({
  item,
  pending,
  onSave,
  onRemove,
}: {
  item: NyxCuratedItem;
  pending: boolean;
  onSave: (item: NyxCuratedItem, patch: { description: string; minIntimacyTier: IntimacyTier }) => void;
  onRemove: (id: string) => void;
}) {
  const [description, setDescription] = useState(item.description);
  const [minTier, setMinTier] = useState(item.minIntimacyTier);

  return (
    <article className="acard">
      <div className="thumb">
        {item.mediaType === "VIDEO" ? (
          <video
            src={`/api/admin/nyx-curated/${item.id}/file`}
            muted
            playsInline
            controls
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <img src={`/api/admin/nyx-curated/${item.id}/file`} alt="" />
        )}
        <span className="badge up">{item.mediaType}</span>
        {item.sentToPlayer ? <span className="badge">VERSTUURD</span> : null}
      </div>
      <div className="ab">
        <div className="td-sub mono">{relTime(item.createdAt)} · min {item.minIntimacyTier}</div>
        <textarea
          className="input"
          rows={3}
          disabled={pending}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ marginTop: 8, width: "100%", fontSize: 12, resize: "vertical" }}
        />
        <select
          className="input"
          value={minTier}
          disabled={pending}
          onChange={(e) => setMinTier(e.target.value as IntimacyTier)}
          style={{ marginTop: 8, width: "100%" }}
        >
          {TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {INTIMACY_TIER_LABELS[tier]}
            </option>
          ))}
        </select>
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn sm gold"
            type="button"
            disabled={pending}
            onClick={() => void onSave(item, { description, minIntimacyTier: minTier })}
          >
            Opslaan
          </button>
          <button className="btn sm" type="button" disabled={pending} onClick={() => void onRemove(item.id)}>
            Verwijder
          </button>
        </div>
        <div className="td-sub mono" style={{ marginTop: 8, fontSize: 10 }}>
          {item.id}
        </div>
      </div>
    </article>
  );
}
