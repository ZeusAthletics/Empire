"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Radar } from "lucide-react";
import { Tag } from "@/components/ui/Tag";
import { Plate } from "@/components/ui/Plate";
import { useEmpireUI } from "@/components/empire-ui-context";
import type { Opportunity } from "@/server/domain/opportunity/types";

export function RadarScreen({ initial }: { initial: Opportunity[] }) {
  const { toast } = useEmpireUI();
  const [items, setItems] = useState(initial);
  const [pending, setPending] = useState<string | null>(null);

  async function act(id: string, action: "save" | "dismiss") {
    setPending(id);
    const response = await fetch(`/api/radar/${id}/${action}`, { method: "POST" });
    const data = (await response.json()) as { ok: boolean; error?: string };
    setPending(null);
    if (!response.ok || !data.ok) {
      toast(data.error ?? "Actie mislukt.");
      return;
    }
    if (action === "dismiss") setItems((current) => current.filter((item) => item.id !== id));
    else setItems((current) => current.map((item) => (item.id === id ? { ...item, status: "SAVED" } : item)));
    toast(action === "save" ? "Bewaard" : "Genegeerd");
  }

  return (
    <>
      <header className="hero" style={{ paddingBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/home" className="btn btn-ghost btn-icon" aria-label="Terug">
            <ArrowLeft size={17} strokeWidth={2.2} />
          </Link>
          <div>
            <span className="eyebrow muted">Handmatige bron</span>
            <h1 className="display d-md" style={{ margin: 0 }}>
              Radar
            </h1>
          </div>
        </div>
      </header>

      <div className="section stack" style={{ gap: 12 }}>
        {items.length === 0 ? (
          <div className="card">
            <p className="body">Geen open kansen. Nyx maakt hier geen missie van.</p>
          </div>
        ) : (
          items.map((item) => (
            <article key={item.id} className="card">
              <div className="card-head">
                <span className="t eyebrow">
                  <Radar size={13} strokeWidth={2} /> {item.category.toLowerCase()}
                </span>
                <Tag>{`${item.relevanceScore}`}</Tag>
              </div>
              <Plate kind="city" className="wide" label={item.locationName ?? undefined} />
              <h3 className="display d-sm" style={{ margin: "10px 0 6px" }}>
                {item.title}
              </h3>
              <p className="body" style={{ margin: "0 0 10px", color: "var(--ink-2)" }}>
                {item.summary}
              </p>
              {item.locationName ? (
                <p className="meta" style={{ display: "flex", alignItems: "center", gap: 4, margin: "0 0 10px" }}>
                  <MapPin size={12} strokeWidth={2} /> {item.locationName}
                </p>
              ) : null}
              <div className="stack" style={{ gap: 6, marginBottom: 12 }}>
                {item.reasonsForRelevance.map((reason) => (
                  <p key={reason} className="meta" style={{ margin: 0 }}>
                    {reason}
                  </p>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-gold btn-sm"
                  style={{ flex: 1 }}
                  type="button"
                  disabled={pending === item.id || item.status === "SAVED"}
                  onClick={() => void act(item.id, "save")}
                >
                  {item.status === "SAVED" ? "Bewaard" : "Save"}
                </button>
                <button
                  className="btn btn-quiet btn-sm"
                  type="button"
                  disabled={pending === item.id}
                  onClick={() => void act(item.id, "dismiss")}
                >
                  Ignore
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </>
  );
}
