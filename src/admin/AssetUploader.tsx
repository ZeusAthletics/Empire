"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AssetUploader() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("kind", "JOURNAL");
      const response = await fetch("/api/media", { method: "POST", body });
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

  return (
    <label className="drop">
      <input
        type="file"
        accept="image/*"
        disabled={pending}
        onChange={(event) => void onFile(event.target.files?.[0])}
      />
      <div className="eyebrow">Upload</div>
      <p className="muted" style={{ margin: "8px 0 0" }}>
        {pending ? "Bezig…" : "Bestand naar Storage. Ongekeurd blijft een gradient op de telefoon."}
      </p>
      {error ? <p style={{ color: "var(--coral)", margin: "8px 0 0" }}>{error}</p> : null}
    </label>
  );
}

export function AssetApprove({ id, approved }: { id: string; approved: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    await fetch(`/api/media/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: !approved }),
    });
    router.refresh();
    setPending(false);
  }

  return (
    <button className={`btn sm ${approved ? "" : "gold"}`} type="button" disabled={pending} onClick={() => void toggle()}>
      {approved ? "Intrekken" : "Goedkeuren"}
    </button>
  );
}
