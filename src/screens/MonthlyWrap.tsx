"use client";

import { useRouter } from "next/navigation";
import { BarChart3, Calendar, Check, ChevronLeft, Users } from "lucide-react";
import { Bar } from "@/components/ui/Bar";
import { HeroArt } from "@/components/ui/HeroArt";
import { Plate } from "@/components/ui/Plate";
import { formatDateLabel, formatTime } from "@/server/domain/journal/dates";
import type { JournalEntry, MonthlyWrap as MonthlyWrapData } from "@/server/domain/journal/types";
import { formatEuro } from "@/lib/stats";

const BLOCKS: { key: keyof MonthlyWrapData; label: string }[] = [
  { key: "biggestWin", label: "Grootste overwinning" },
  { key: "biggestMistake", label: "Grootste fout" },
  { key: "bestRelationship", label: "Meest waardevolle relatie" },
  { key: "keyDecision", label: "Belangrijkste beslissing" },
  { key: "bestMission", label: "Meest waardevolle missie" },
  { key: "timeSink", label: "Waar te veel tijd naartoe ging" },
  { key: "whatChanged", label: "Wat er echt veranderd is" },
];

export function MonthlyWrap({ wrap, entries }: { wrap: MonthlyWrapData; entries: JournalEntry[] }) {
  const router = useRouter();
  const shots = wrap.entryIds
    .map((id) => entries.find((entry) => entry.id === id))
    .filter((entry): entry is JournalEntry => Boolean(entry))
    .flatMap((entry) => entry.media)
    .slice(0, 6);

  return (
    <>
      <header className="hero wrap-hero">
        <HeroArt seed={4} />
        <button
          className="btn btn-ghost btn-icon"
          type="button"
          aria-label="Terug"
          style={{ marginBottom: 18 }}
          onClick={() => router.push("/journal")}
        >
          <ChevronLeft size={18} strokeWidth={2.2} />
        </button>
        <span className="eyebrow">Campaign wrap</span>
        <h1 className="display d-xl" style={{ margin: "8px 0 2px", fontSize: 38 }}>
          {wrap.label}
        </h1>
        <p className="script" style={{ fontSize: 24, margin: "2px 0 0" }}>
          Month so far
        </p>
      </header>

      <div className="section" style={{ marginTop: 4 }}>
        <div className="grid-2" style={{ gap: 9 }}>
          {[
            ["Events", wrap.events, Calendar],
            ["Nieuwe contacten", wrap.newContacts, Users],
            ["Missies voltooid", wrap.missionsCompleted, Check],
            ["Empire value", `+${formatEuro(wrap.empireDelta)}`, BarChart3],
          ].map(([label, value, Icon]) => {
            const MetricIcon = Icon as typeof Calendar;
            return (
              <div key={String(label)} className="metric">
                <span style={{ color: "var(--gold)" }}>
                  <MetricIcon size={15} strokeWidth={2} />
                </span>
                <span className="v">{value as string | number}</span>
                <span className="k">{label as string}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="section">
        <div className="card">
          <span className="eyebrow">Statverschuiving</span>
          <div className="stack" style={{ gap: 8, marginTop: 10 }}>
            {Object.entries(wrap.deltas).map(([key, value]) => (
              <div
                key={key}
                style={{ display: "grid", gridTemplateColumns: "90px 1fr 34px", alignItems: "center", gap: 9 }}
              >
                <span className="eyebrow muted" style={{ fontSize: 9 }}>
                  {key.toUpperCase()}
                </span>
                <Bar pct={value * 9} className="thin" />
                <span style={{ fontSize: 12, fontWeight: 800, color: "var(--gold-soft)", textAlign: "right" }}>
                  +{value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {shots.length ? (
        <div className="section">
          <div className="section-head">
            <h2 className="display d-sm">Beeld uit de maand</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
            {shots.map((item, index) => (
              <div key={`${item.kind}-${index}`} style={{ aspectRatio: "1", position: "relative" }}>
                <Plate kind={item.kind} className="fill" label={item.label} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="section">
        <div className="card">
          {BLOCKS.map((block) => (
            <div key={block.key} className="wrap-block">
              <div className="k">{block.label}</div>
              <div className="v">{String(wrap[block.key] ?? "")}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="section" style={{ marginBottom: 12 }}>
        <div className="card" style={{ background: "linear-gradient(180deg, #241A0E, #141110)" }}>
          <span className="eyebrow">Conclusie van Nyx</span>
          <p
            style={{
              margin: "10px 0 0",
              fontFamily: "var(--font-caveat), Caveat, cursive",
              fontSize: 25,
              lineHeight: 1.3,
              color: "var(--gold-soft)",
            }}
          >
            “{wrap.nyx}”
          </p>
          {wrap.generatedAt ? (
            <p className="meta" style={{ margin: "12px 0 0" }}>
              Gegenereerd op {formatDateLabel(wrap.generatedAt)} om {formatTime(wrap.generatedAt)}
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
