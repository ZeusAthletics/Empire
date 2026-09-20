"use client";

/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { NyxIdentityRef } from "@/server/domain/nyx/identity/repository";

const ROLES = [
  { value: "FACE", label: "Face (verplicht voor foto's)" },
  { value: "BODY", label: "Body" },
  { value: "SIGNATURE_OUTFIT", label: "Signature outfit" },
  { value: "VARIANT_OK", label: "Variant OK" },
] as const;

export function NyxIdentityView({ refs }: { refs: NyxIdentityRef[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [role, setRole] = useState<(typeof ROLES)[number]["value"]>("FACE");

  async function onFile(file: File | undefined) {
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("role", role);
      const response = await fetch("/api/admin/nyx-identity", { method: "POST", body });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Upload mislukt.");
        return;
      }
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch {
      setError("Geen verbinding.");
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    setPending(true);
    await fetch(`/api/admin/nyx-identity?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    router.refresh();
    setPending(false);
  }

  return (
    <>
      <div className="head">
        <h1 className="display" style={{ fontSize: 22 }}>
          Nyx — identity vault
        </h1>
        <span className="muted">Canonieke refs voor gpt-image-1 · niet de spelergalerij</span>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <label className="field" style={{ display: "block", marginBottom: 12 }}>
          <span className="eyebrow">Rol van deze still</span>
          <select
            className="input"
            value={role}
            disabled={pending}
            onChange={(event) => setRole(event.target.value as (typeof ROLES)[number]["value"])}
            style={{ marginTop: 6, maxWidth: 360 }}
          >
            {ROLES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          disabled={pending}
          style={{ display: "none" }}
          onChange={(event) => void onFile(event.target.files?.[0])}
        />

        <div className="drop">
          <div className="eyebrow">Upload</div>
          <p className="muted" style={{ margin: "8px 0 12px" }}>
            6–12 stills: face close-up, 3/4, full body, gold latex + zwart leer.
          </p>
          <button
            className="btn gold sm"
            type="button"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            {pending ? "Bezig…" : "Kies afbeelding"}
          </button>
        </div>
        {error ? <p style={{ color: "var(--coral)", marginTop: 10 }}>{error}</p> : null}
      </div>

      <div className="agrid" style={{ marginTop: 14 }}>
        {refs.map((ref) => (
          <article key={ref.id} className="acard">
            <div className="thumb">
              <img src={`/api/admin/nyx-identity/${ref.id}/file`} alt="" />
              <span className="badge up">{ref.role}</span>
            </div>
            <div className="ab">
              <div className="td-main">{ref.label ?? ref.role}</div>
              <div className="td-sub mono">{ref.storagePath.split("/").pop()}</div>
              <div style={{ marginTop: 10 }}>
                <button className="btn sm" type="button" disabled={pending} onClick={() => void remove(ref.id)}>
                  Verwijder
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {!refs.length ? (
        <div className="empty" style={{ marginTop: 14 }}>
          Nog geen referenties. Upload minstens één <b>Face</b> voordat Nyx autonoom foto&apos;s mag sturen.
        </div>
      ) : null}
    </>
  );
}
