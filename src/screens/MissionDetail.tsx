"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Brain,
  Check,
  Clock,
  FileText,
  MapPin,
  Navigation,
  Shield,
} from "lucide-react";
import { Bar } from "@/components/ui/Bar";
import { Plate } from "@/components/ui/Plate";
import { Tag } from "@/components/ui/Tag";
import { useEmpireUI } from "@/components/empire-ui-context";
import { postMissionAction } from "@/lib/mission-api";
import {
  DIFFICULTY_LABEL,
  KIND_LABEL,
  STATUS_LABEL,
  TRACK_LABEL,
  difficultyTag,
  missionPlate,
} from "@/lib/missions";
import { doneCount, requiredCount, type PublicMission, type PublicObjective } from "@/server/domain/mission/types";

function ObjectiveRow({
  objective,
  disabled,
  onToggle,
}: {
  objective: PublicObjective;
  disabled: boolean;
  onToggle: (id: string) => void;
}) {
  const done = objective.status === "COMPLETED";
  return (
    <label className="obj-row">
      <input
        type="checkbox"
        className="obj-check"
        checked={done}
        disabled={disabled || done}
        onChange={() => {
          if (!done) onToggle(objective.id);
        }}
        aria-label={objective.label}
      />
      <span
        style={{
          flex: 1,
          fontSize: 13.5,
          color: done ? "var(--ink-3)" : undefined,
          textDecoration: done ? "line-through" : undefined,
        }}
      >
        {objective.label}
        {objective.optional ? <span className="meta"> · optioneel</span> : null}
      </span>
    </label>
  );
}

export function MissionDetail({ mission }: { mission: PublicMission }) {
  const { openNyx, toast } = useEmpireUI();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const required = mission.objectives.filter((objective) => !objective.optional);
  const optional = mission.objectives.filter((objective) => objective.optional);
  const done = doneCount(mission);
  const total = requiredCount(mission);
  const closed = mission.status === "COMPLETED" || mission.status === "COMPLETED_UNVERIFIED";
  const locked = mission.status === "LOCKED";
  const proposed = mission.status === "PROPOSED";
  const frozen = closed || locked || pending;

  const meta = [
    {
      label: "Locatie",
      value: mission.locationName
        ? `${mission.locationName}${mission.locationAddress ? ` · ${mission.locationAddress}` : ""}`
        : "—",
      icon: MapPin,
    },
    { label: "Tijdsinschatting", value: mission.estimateLabel ?? "—", icon: Clock },
    { label: "Moeilijkheid", value: DIFFICULTY_LABEL[mission.difficulty], icon: Shield },
    { label: "Verwachte impact", value: mission.impact ?? "—", icon: BarChart3 },
    { label: "Bewijs vereist", value: mission.evidenceRequirement, icon: FileText },
    { label: "Status", value: STATUS_LABEL[mission.status], icon: Check },
  ];

  async function run(action: "continue" | "activate", objectiveId?: string) {
    setPending(true);
    try {
      const result = await postMissionAction(mission.id, action, objectiveId ? { objectiveId } : undefined);
      toast(result.message ?? (action === "activate" ? "Missie geactiveerd" : "Missie bijgewerkt"));
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Actie mislukt.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <header style={{ padding: "14px 16px 8px", display: "flex", alignItems: "center", gap: 10 }}>
        <Link href="/missions" className="btn btn-ghost btn-icon" aria-label="Terug">
          <ArrowLeft size={18} strokeWidth={2.2} />
        </Link>
        <span className="eyebrow muted">Mission file</span>
        <button className="btn btn-ghost btn-icon" style={{ marginLeft: "auto" }} type="button" onClick={openNyx} aria-label="Vraag Nyx">
          <Brain size={18} strokeWidth={2} />
        </button>
      </header>

      <div className="section" style={{ marginTop: 0 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 104, position: "relative" }}>
            <Plate kind={missionPlate(mission.kind)} className="fill" />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(180deg,transparent,rgba(11,9,7,.9))",
              }}
            />
            <div style={{ position: "absolute", left: 13, bottom: 10, right: 13 }}>
              <span className="eyebrow">
                {KIND_LABEL[mission.kind]} · {TRACK_LABEL[mission.track]}
              </span>
              <h1 className="display d-lg" style={{ margin: "5px 0 0" }}>
                {mission.title}
              </h1>
            </div>
          </div>
          <div style={{ padding: 13 }}>
            <span className="eyebrow muted">Waarom dit telt</span>
            <p className="body" style={{ margin: "6px 0 12px" }}>
              {mission.why}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <Tag>{`+${mission.xpReward} XP`}</Tag>
              <Tag className="alt">{`${mission.statReward.key.toUpperCase()} +${mission.statReward.amount}`}</Tag>
              <Tag className={difficultyTag(mission.difficulty)}>{DIFFICULTY_LABEL[mission.difficulty]}</Tag>
            </div>
            <div className="card flat" style={{ padding: 11 }}>
              <span className="eyebrow">Hoofddoel</span>
              <p style={{ margin: "5px 0 0", fontSize: 14.5, fontWeight: 600 }}>{mission.mainObjective}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <h2 className="display d-sm">Objectives</h2>
          <span className="eyebrow muted">
            {done} / {total} klaar
          </span>
        </div>
        <div className="card stack" style={{ gap: 2 }}>
          {required.map((objective) => (
            <ObjectiveRow
              key={objective.id}
              objective={objective}
              disabled={frozen}
              onToggle={(id) => run("continue", id)}
            />
          ))}
          {optional.length ? (
            <>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line-soft)" }}>
                <span className="eyebrow muted">Optioneel</span>
              </div>
              {optional.map((objective) => (
                <ObjectiveRow
                  key={objective.id}
                  objective={objective}
                  disabled={frozen}
                  onToggle={(id) => run("continue", id)}
                />
              ))}
            </>
          ) : null}
          <div style={{ marginTop: 12 }}>
            <Bar pct={total ? (done / total) * 100 : 0} className="thin" />
          </div>
        </div>
      </div>

      {mission.contacts.length ? (
        <div className="section">
          <div className="section-head">
            <h2 className="display d-sm">Betrokken mensen</h2>
          </div>
          <div className="stack">
            {mission.contacts.map((contact) => (
              <div key={contact.id} className="card flat" style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    border: "1px solid var(--line)",
                    color: "var(--gold)",
                    fontWeight: 800,
                  }}
                >
                  {contact.name[0]}
                </span>
                <span style={{ flex: 1 }}>
                  <b style={{ fontSize: 13.5 }}>{contact.name}</b>
                  <span className="meta" style={{ display: "block" }}>
                    {contact.role}
                  </span>
                </span>
                <Link href={`/map?contact=${contact.id}`} className="btn btn-quiet btn-sm">
                  Op kaart
                </Link>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="section">
        <div className="card stack" style={{ gap: 0 }}>
          {meta.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  gap: 11,
                  padding: "10px 0",
                  borderTop: index ? "1px solid var(--line-soft)" : undefined,
                }}
              >
                <span style={{ color: "var(--gold)", flex: "0 0 auto" }}>
                  <Icon size={15} strokeWidth={2} />
                </span>
                <span style={{ flex: 1 }}>
                  <span className="eyebrow muted" style={{ display: "block", marginBottom: 2 }}>
                    {item.label}
                  </span>
                  <span style={{ fontSize: 13 }}>{item.value}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="section" style={{ marginBottom: 10 }}>
        <div className="stack">
          {closed ? (
            <div className="card flat" style={{ textAlign: "center", padding: 18 }}>
              <span style={{ color: "var(--gold)" }}>
                <Check size={26} strokeWidth={1.8} />
              </span>
              <p className="body" style={{ margin: "8px 0 0" }}>
                Voltooid. +{mission.xpReward} XP en {mission.statReward.key} +{mission.statReward.amount} zijn
                toegekend.
              </p>
            </div>
          ) : locked ? (
            <button className="btn btn-gold btn-block" type="button" disabled>
              Vergrendeld
            </button>
          ) : proposed ? (
            <button className="btn btn-gold btn-block" type="button" disabled={pending} onClick={() => run("activate")}>
              Activeer missie <ArrowRight size={15} strokeWidth={2.4} />
            </button>
          ) : (
            <button className="btn btn-gold btn-block" type="button" disabled={pending} onClick={() => run("continue")}>
              Continue mission <ArrowRight size={15} strokeWidth={2.4} />
            </button>
          )}
          <div className="grid-2">
            <Link href={`/map?mission=${mission.id}`} className="btn btn-ghost">
              <Navigation size={15} strokeWidth={2.2} /> Open map
            </Link>
            <button className="btn btn-ghost" type="button" onClick={openNyx}>
              <Brain size={15} strokeWidth={2.2} /> Ask Nyx
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
