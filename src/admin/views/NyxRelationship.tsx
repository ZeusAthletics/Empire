"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { relTime } from "@/admin/format";
import { INTIMACY_TIER_LABELS } from "@/server/domain/nyx/curated/tier";
import type { RelationshipDirection } from "@/server/domain/nyx/relationship/direction";
import type { MediaBudgetRemaining, NyxMediaBudget } from "@/server/domain/nyx/relationship/mediaBudget";
import type { AdminIntimacyAxis } from "@/server/ai/schemas/relationship.schema";
import type { RelationshipSnapshot } from "@/server/domain/nyx/relationship/repository";
import type { IntimacyTier } from "@/server/domain/nyx/outreach/intimacy";

function ScoreBar({ label, value, tone }: { label: string; value: number; tone?: "jade" | "coral" | "" }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span className="lab">{label}</span>
        <span className="mono muted">{pct}</span>
      </div>
      <div className={`bar ${tone ?? ""}`.trim()}>
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function AdminIntimacyAxisBlock({ label, axis }: { label: string; axis: AdminIntimacyAxis }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <ScoreBar label={label} value={axis.score} />
      {axis.recommendations.length ? (
        <ul style={{ margin: "4px 0 0", paddingLeft: 18, color: "var(--ink-2)", fontSize: 12.5, lineHeight: 1.5 }}>
          {axis.recommendations.map((item) => (
            <li key={item} style={{ marginBottom: 4 }}>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
          Geen aanbevelingen in deze snapshot.
        </p>
      )}
    </div>
  );
}

function adminIntimacyHasData(profile: RelationshipSnapshot["adminIntimacyProfile"]): boolean {
  const axes = [
    profile.physicalAttraction,
    profile.dating,
    profile.relationship,
    profile.physicalIntimacy,
  ];
  return axes.some((axis) => axis.score > 0 || axis.recommendations.length > 0);
}

export function NyxRelationshipView({
  playerName,
  latest,
  history,
  budget: initialBudget,
  usage,
  direction: initialDirection,
  loadError,
}: {
  playerName: string;
  latest: RelationshipSnapshot | null;
  history: RelationshipSnapshot[];
  budget: NyxMediaBudget;
  usage: MediaBudgetRemaining | null;
  direction: RelationshipDirection;
  loadError: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [maxPhotos, setMaxPhotos] = useState(initialBudget.maxPhotosPerDay);
  const [maxVideos, setMaxVideos] = useState(initialBudget.maxVideosPerDay);
  const [directionChoice, setDirectionChoice] = useState<"natural" | string>(() =>
    initialDirection.mode === "guided" && initialDirection.scenarioId
      ? initialDirection.scenarioId
      : "natural",
  );

  useEffect(() => {
    setDirectionChoice(
      initialDirection.mode === "guided" && initialDirection.scenarioId
        ? initialDirection.scenarioId
        : "natural",
    );
  }, [initialDirection]);

  async function runReview() {
    setPending(true);
    setError(null);
    setNote(null);
    try {
      const response = await fetch("/api/admin/nyx-relationship", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Update mislukt.");
        return;
      }
      setNote("Nyx heeft een nieuwe relatie-analyse achtergelaten.");
      router.refresh();
    } catch {
      setError("Geen verbinding.");
    } finally {
      setPending(false);
    }
  }

  async function saveDirection() {
    setPending(true);
    setError(null);
    setNote(null);
    try {
      const body =
        directionChoice === "natural"
          ? { directionMode: "natural" as const }
          : { directionMode: "guided" as const, scenarioId: directionChoice };
      const response = await fetch("/api/admin/nyx-relationship", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Richting opslaan mislukt.");
        return;
      }
      setNote(
        directionChoice === "natural"
          ? "Nyx volgt geen gekozen scenario — natuurlijke progressie."
          : "Gekozen toekomstscenario opgeslagen voor Nyx (intern).",
      );
      router.refresh();
    } catch {
      setError("Geen verbinding.");
    } finally {
      setPending(false);
    }
  }

  async function saveBudget() {
    setPending(true);
    setError(null);
    setNote(null);
    try {
      const response = await fetch("/api/admin/nyx-relationship", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxPhotosPerDay: maxPhotos, maxVideosPerDay: maxVideos }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Budget opslaan mislukt.");
        return;
      }
      setNote("Dagmaximum media opgeslagen.");
      router.refresh();
    } catch {
      setError("Geen verbinding.");
    } finally {
      setPending(false);
    }
  }

  const tier = latest?.intimacyTier as IntimacyTier | null | undefined;
  const scenarios = latest?.progressScenarios ?? [];
  const guidedActive =
    initialDirection.mode === "guided" &&
    initialDirection.scenarioId &&
    initialDirection.scenarioTitle;
  const guidedInLatest =
    guidedActive && scenarios.some((item) => item.id === initialDirection.scenarioId);

  return (
    <div className="memory-page">
      <div className="head">
        <h1 className="display" style={{ fontSize: 22 }}>
          Nyx — relatie
        </h1>
        <span className="muted mono">
          {playerName} · admin-only · Hardwig ziet dit niet
        </span>
      </div>

      <p className="memory-explainer">
        Interne meter: vertrouwen, warmte en spanning zoals Nyx die <strong>nu</strong> ervaart. Druk op de knop
        voor een verse analyse. Onder <strong>Toekomstscenario&apos;s</strong> zie je wat Nyx voor zich ziet tussen
        haar en Hardwig — kies één pad of laat open voor natuurlijke progressie. Het dagmaximum voor
        foto&apos;s/video&apos;s geldt voor outreach én chat-verzoeken (Nyx mag altijd minder sturen).
      </p>

      {loadError ? (
        <div className="card" style={{ marginBottom: 14, borderColor: "rgba(240,82,82,.45)" }}>
          <span className="eyebrow" style={{ color: "var(--coral)" }}>
            Laden mislukt
          </span>
          <p className="body" style={{ margin: "8px 0 0", color: "var(--ink-2)" }}>
            {loadError}
          </p>
        </div>
      ) : null}

      <div className="grid g2" style={{ alignItems: "start" }}>
        <div className="card gold">
          <div className="eyebrow">Relatiemeter</div>
          {latest ? (
            <>
              <h2 className="display d-sm" style={{ margin: "10px 0 6px", color: "var(--ink-1)" }}>
                {latest.headline}
              </h2>
              <p className="mono muted" style={{ margin: "0 0 14px" }}>
                {tier ? INTIMACY_TIER_LABELS[tier] : "—"} · {relTime(latest.createdAt)}
              </p>
              <ScoreBar label="Vertrouwen" value={latest.trustScore} tone="jade" />
              <ScoreBar label="Warmte" value={latest.warmthScore} />
              <ScoreBar label="Spanning" value={latest.tensionScore} tone="coral" />
              <p style={{ margin: "14px 0 0", color: "var(--ink-2)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {latest.analysis}
              </p>
              {latest.highlights.length ? (
                <div style={{ marginTop: 14 }}>
                  <div className="eyebrow">Highlights</div>
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--ink-2)" }}>
                    {latest.highlights.map((item) => (
                      <li key={item} style={{ marginBottom: 4 }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {latest.concerns.length ? (
                <div style={{ marginTop: 14 }}>
                  <div className="eyebrow">Voorbehoud</div>
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--ink-2)" }}>
                    {latest.concerns.map((item) => (
                      <li key={item} style={{ marginBottom: 4 }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <div className="empty" style={{ padding: "24px 0" }}>
              <div className="empty-title">Nog geen analyse</div>
              <p className="muted" style={{ margin: "8px 0 0", fontSize: 12 }}>
                Vraag Nyx om een eerste relatie-update.
              </p>
            </div>
          )}
          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn gold sm" type="button" disabled={pending} onClick={() => void runReview()}>
              {pending ? "Bezig…" : "Vraag Nyx om een update"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="card">
          <div className="eyebrow">Dagmaximum media</div>
          <p className="muted" style={{ margin: "8px 0 12px", fontSize: 12.5 }}>
            Maximum per UTC-dag. Nyx kan ook niets sturen. Admin testfoto&apos;s tellen niet mee in outreach-stats;
            chat + outreach wel.
          </p>
          {usage ? (
            <p className="mono muted" style={{ marginBottom: 12 }}>
              Vandaag: {usage.sent.photos}/{usage.budget.maxPhotosPerDay} foto&apos;s · {usage.sent.videos}/
              {usage.budget.maxVideosPerDay} video&apos;s
            </p>
          ) : null}
          <label className="field" style={{ display: "block", marginBottom: 10 }}>
            <span className="eyebrow">Max foto&apos;s / dag</span>
            <input
              className="input"
              type="number"
              min={0}
              max={20}
              value={maxPhotos}
              disabled={pending}
              onChange={(e) => setMaxPhotos(Number.parseInt(e.target.value, 10) || 0)}
              style={{ marginTop: 6, width: "100%", maxWidth: 120 }}
            />
          </label>
          <label className="field" style={{ display: "block", marginBottom: 12 }}>
            <span className="eyebrow">Max video&apos;s / dag</span>
            <input
              className="input"
              type="number"
              min={0}
              max={10}
              value={maxVideos}
              disabled={pending}
              onChange={(e) => setMaxVideos(Number.parseInt(e.target.value, 10) || 0)}
              style={{ marginTop: 6, width: "100%", maxWidth: 120 }}
            />
          </label>
          <button className="btn sm" type="button" disabled={pending} onClick={() => void saveBudget()}>
            Opslaan maximum
          </button>
        </div>

        <div className="card">
          <div className="eyebrow">Nyx — interne intimiteit (admin)</div>
          <p className="muted" style={{ margin: "8px 0 12px", fontSize: 12.5 }}>
            Door Nyx ingevuld bij relatie-update. Alleen voor Empire Ops — wordt <strong>niet</strong> in chat of
            outreach aan Hardwig doorgegeven.
          </p>
          {!latest ? (
            <p className="muted" style={{ fontSize: 12.5 }}>
              Vraag eerst een relatie-update.
            </p>
          ) : !adminIntimacyHasData(latest.adminIntimacyProfile) ? (
            <p className="muted" style={{ fontSize: 12.5 }}>
              Deze snapshot heeft nog geen intimiteitsmeter (oude analyse). Vraag Nyx opnieuw om een update.
            </p>
          ) : (
            <>
              <AdminIntimacyAxisBlock label="Fysieke aantrekkingskracht" axis={latest.adminIntimacyProfile.physicalAttraction} />
              <AdminIntimacyAxisBlock label="Dating" axis={latest.adminIntimacyProfile.dating} />
              <AdminIntimacyAxisBlock label="Relationship" axis={latest.adminIntimacyProfile.relationship} />
              <AdminIntimacyAxisBlock label="Xxx" axis={latest.adminIntimacyProfile.physicalIntimacy} />
              <p className="mono muted" style={{ margin: 0, fontSize: 11 }}>
                Snapshot: {relTime(latest.createdAt)}
              </p>
            </>
          )}
        </div>

        <div className="card">
          <div className="eyebrow">Toekomstscenario&apos;s</div>
          <p className="muted" style={{ margin: "8px 0 12px", fontSize: 12.5 }}>
            Nyx&apos; plausibele paden met Hardwig (intern). Alleen actief na opslaan; Hardwig ziet dit niet.
          </p>
          {guidedActive && !guidedInLatest ? (
            <p className="mono muted" style={{ marginBottom: 10, fontSize: 11 }}>
              Huidige keuze: «{initialDirection.scenarioTitle}» (van eerdere analyse — kies opnieuw na update
              indien gewenst).
            </p>
          ) : null}
          {!latest || scenarios.length === 0 ? (
            <p className="muted" style={{ fontSize: 12.5 }}>
              Nog geen scenario&apos;s. Vraag Nyx om een relatie-update; daarna verschijnen opties hier.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label
                className="card flat tap"
                style={{
                  display: "block",
                  padding: "10px 12px",
                  cursor: pending ? "default" : "pointer",
                  borderColor: directionChoice === "natural" ? "rgba(201, 162, 39, 0.55)" : undefined,
                }}
              >
                <input
                  type="radio"
                  name="nyx-direction"
                  value="natural"
                  checked={directionChoice === "natural"}
                  disabled={pending}
                  onChange={() => setDirectionChoice("natural")}
                  style={{ marginRight: 8 }}
                />
                <span className="body" style={{ fontSize: 13 }}>
                  <strong>Natuurlijk</strong> — geen gekozen scenario; band evolueert via chat.
                </span>
              </label>
              {scenarios.map((scenario) => (
                <label
                  key={scenario.id}
                  className="card flat tap"
                  style={{
                    display: "block",
                    padding: "10px 12px",
                    cursor: pending ? "default" : "pointer",
                    borderColor: directionChoice === scenario.id ? "rgba(201, 162, 39, 0.55)" : undefined,
                  }}
                >
                  <input
                    type="radio"
                    name="nyx-direction"
                    value={scenario.id}
                    checked={directionChoice === scenario.id}
                    disabled={pending}
                    onChange={() => setDirectionChoice(scenario.id)}
                    style={{ marginRight: 8, verticalAlign: "top", marginTop: 3 }}
                  />
                  <span>
                    <span className="display d-sm" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
                      {scenario.title}
                    </span>
                    <span className="body" style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>
                      {scenario.summary}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <button
            className="btn sm"
            type="button"
            style={{ marginTop: 12 }}
            disabled={pending || !latest}
            onClick={() => void saveDirection()}
          >
            Richting opslaan
          </button>
        </div>
        </div>
      </div>

      {error ? <p style={{ color: "var(--coral)", marginTop: 12 }}>{error}</p> : null}
      {note ? <p style={{ color: "var(--jade)", marginTop: 12 }}>{note}</p> : null}

      {history.length > 1 ? (
        <div style={{ marginTop: 22 }}>
          <div className="head" style={{ marginBottom: 8 }}>
            <h2 className="display" style={{ fontSize: 16 }}>
              Eerdere snapshots
            </h2>
          </div>
          <div className="table">
            <div className="thead">
              <div className="tr" style={{ gridTemplateColumns: "1.4fr .5fr .5fr .5fr .5fr" }}>
                <span className="th">Headline</span>
                <span className="th">Trust</span>
                <span className="th">Warmte</span>
                <span className="th">Spanning</span>
                <span className="th">Wanneer</span>
              </div>
            </div>
            {history.slice(1).map((row) => (
              <div key={row.id} className="tr" style={{ gridTemplateColumns: "1.4fr .5fr .5fr .5fr .5fr" }}>
                <div className="td-main">{row.headline}</div>
                <span className="mono muted">{row.trustScore}</span>
                <span className="mono muted">{row.warmthScore}</span>
                <span className="mono muted">{row.tensionScore}</span>
                <span className="mono muted">{relTime(row.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
