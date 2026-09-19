"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ProposalActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: "approve" | "reject") {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/proposals/${id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Actie mislukt.");
        return;
      }
      router.refresh();
    } catch {
      setError("Geen verbinding.");
    } finally {
      setPending(false);
    }
  }

  if (status !== "PENDING") return null;

  return (
    <div className="actions">
      <button className="btn gold sm" type="button" disabled={pending} onClick={() => void decide("approve")}>
        Goedkeuren
      </button>
      <button className="btn danger sm" type="button" disabled={pending} onClick={() => void decide("reject")}>
        Afwijzen
      </button>
      {error ? <span className="td-sub" style={{ color: "var(--coral)" }}>{error}</span> : null}
    </div>
  );
}
