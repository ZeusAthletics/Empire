"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { NyxIdentityRef } from "@/server/domain/nyx/identity/repository";

const ROLES = [
  { value: "FACE", label: "Face (verplicht voor foto's)" },
  { value: "BODY", label: "Body" },
  { value: "SIGNATURE_OUTFIT", label: "Signature outfit" },
  { value: "VARIANT_OK", label: "Variant OK" },
] as const;

export function NyxIdentityView({ refs }: { refs: NyxIdentityRef[] }) {
  const router = useRouter();
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
    <div className="admin-page">
      <header className="admin-head">
        <h1>Nyx — identity vault</h1>
        <p className="muted">Canonieke referenties voor gpt-image-1 + vision gate. Niet de spelergalerij.</p>
      </header>

      <div className="card" style={{ marginBottom: 16 }}>
        <span className="eyebrow">Upload</span>
        <select
          className="input"
          value={role}
          disabled={pending}
          onChange={(event) => setRole(event.target.value as (typeof ROLES)[number]["value"])}
          style={{ marginTop: 8, marginBottom: 8, maxWidth: 320 }}
        >
          {ROLES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <label className="drop">
          <input
            type="file"
            accept="image/*"
            disabled={pending}
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
          <p className="muted" style={{ margin: "8px 0 0" }}>
            {pending ? "Bezig…" : "6–12 stills: face close-up, 3/4, full body, gold latex + zwart leer."}
          </p>
        </label>
        {error ? <p style={{ color: "var(--coral)", marginTop: 8 }}>{error}</p> : null}
      </div>

      <div className="stack">
        {refs.length ? (
          refs.map((ref) => (
            <div key={ref.id} className="card flat" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="eyebrow" style={{ minWidth: 120 }}>
                {ref.role}
              </span>
              <span className="meta" style={{ flex: 1 }}>
                {ref.label ?? ref.storagePath}
              </span>
              <button className="btn sm" type="button" disabled={pending} onClick={() => void remove(ref.id)}>
                Verwijder
              </button>
            </div>
          ))
        ) : (
          <p className="muted">Nog geen referenties. Autonome foto&apos;s blijven uit tot FACE ref staat.</p>
        )}
      </div>
    </div>
  );
}
