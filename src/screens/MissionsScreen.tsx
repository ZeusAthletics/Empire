"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronRight,
  Flag,
  MoreHorizontal,
  Plus,
  Shield,
  Star,
  Target,
  Users,
  Zap,
} from "lucide-react";
import { Bar } from "@/components/ui/Bar";
import { EmptyInvite } from "@/components/ui/EmptyInvite";
import { HeroArt } from "@/components/ui/HeroArt";
import { Pill } from "@/components/ui/Pill";
import { Plate } from "@/components/ui/Plate";
import { Tag } from "@/components/ui/Tag";
import { useEmpireUI } from "@/components/empire-ui-context";
import { postMissionAction } from "@/lib/mission-api";
import {
  KIND_LABEL,
  TRACK_LABEL,
  firstSentence,
  missionAccent,
  missionPlate,
  progressLabel,
  statusTag,
} from "@/lib/missions";
import { doneCount, featuredMission, requiredCount } from "@/server/domain/mission/types";
import type { PublicMission } from "@/server/domain/mission/types";

const FILTERS = [
  { k: "active", label: "Active", icon: Target },
  { k: "main", label: "Main story", icon: Star },
  { k: "side", label: "Side quests", icon: Flag },
  { k: "done", label: "Completed", icon: Check },
] as const;

type FilterKey = (typeof FILTERS)[number]["k"];

function KindIcon({ kind }: { kind: PublicMission["kind"] }) {
  if (kind === "BOSS") return <Shield size={12} strokeWidth={2} />;
  if (kind === "EVENT") return <Calendar size={12} strokeWidth={2} />;
  return <Target size={12} strokeWidth={2} />;
}

function MissionRow({ mission }: { mission: PublicMission }) {
  const status =
    mission.status === "COMPLETED" || mission.status === "COMPLETED_UNVERIFIED"
      ? "Voltooid"
      : mission.status === "LOCKED"
        ? "Vergrendeld"
        : "In progress";
  return (
    <Link
      href={`/missions/${mission.id}`}
      className="card flat tap"
      style={{ display: "flex", gap: 0, padding: 0, textAlign: "left", overflow: "hidden" }}
    >
      <span style={{ width: 4, background: missionAccent(mission.kind), flex: "0 0 auto" }} />
      <span style={{ width: 74, flex: "0 0 auto", alignSelf: "stretch", position: "relative" }}>
        <Plate
          kind={missionPlate(mission.kind)}
          className="fill"
          src={mission.coverSrc ?? undefined}
          approved={mission.coverApproved}
        />
      </span>
      <span style={{ flex: 1, minWidth: 0, padding: "11px 12px" }}>
        <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span className="eyebrow muted" style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <KindIcon kind={mission.kind} /> {KIND_LABEL[mission.kind]}
          </span>
          <Tag className={statusTag(mission.status)}>{status}</Tag>
        </span>
        <span className="display d-sm" style={{ display: "block", margin: "5px 0 4px" }}>
          {mission.title}
        </span>
        <span className="body" style={{ display: "block", fontSize: 12, marginBottom: 8 }}>
          {firstSentence(mission.why)}
        </span>
        <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Tag className="alt">{progressLabel(mission)}</Tag>
          {mission.locationName ? <Tag className="alt">{mission.locationName}</Tag> : null}
          <Tag>{`+${mission.xpReward} XP`}</Tag>
        </span>
      </span>
      <span style={{ alignSelf: "center", paddingRight: 10, color: "var(--ink-3)" }}>
        <ChevronRight size={16} strokeWidth={2.2} />
      </span>
    </Link>
  );
}

export function MissionsScreen({ missions }: { missions: PublicMission[] }) {
  const { openNyx, toast } = useEmpireUI();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("active");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const counts = {
    active: missions.filter((mission) => mission.status === "ACTIVE").length,
    main: missions.filter((mission) => mission.track === "MAIN_STORY").length,
    side: missions.filter((mission) => mission.track === "SIDE_QUEST").length,
    done: missions.filter((mission) => mission.status === "COMPLETED" || mission.status === "COMPLETED_UNVERIFIED").length,
  };
  const list =
    filter === "active"
      ? missions.filter((mission) => mission.status === "ACTIVE")
      : filter === "main"
        ? missions.filter((mission) => mission.track === "MAIN_STORY")
        : filter === "side"
          ? missions.filter((mission) => mission.track === "SIDE_QUEST")
          : missions.filter((mission) => mission.status === "COMPLETED" || mission.status === "COMPLETED_UNVERIFIED");
  const featured = featuredMission(missions);
  const suggested = missions.filter((mission) => mission.status === "PROPOSED");
  const required = featured ? requiredCount(featured) : 0;
  const done = featured ? doneCount(featured) : 0;

  async function activate(id: string) {
    setPendingId(id);
    try {
      const result = await postMissionAction(id, "activate");
      toast(result.message ?? "Missie geactiveerd");
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Missie kon niet worden geactiveerd.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      <header className="hero">
        <HeroArt seed={2} />
        <div className="hero-corner">
          <span className="eyebrow">A better you builds a larger tomorrow</span>
        </div>
        <span className="eyebrow" style={{ display: "block", maxWidth: 90, lineHeight: 1.6 }}>
          Discipline builds freedom
        </span>
        <h1 className="display d-xl" style={{ margin: "26px 0 4px" }}>
          Missions
        </h1>
        <span className="eyebrow muted">Real opportunities. Real progress.</span>
        <div className="script" style={{ position: "absolute", right: 16, top: 96, textAlign: "right" }}>
          Execution
          <br />
          changes everything.
        </div>
      </header>

      <div className="chiprow" style={{ marginTop: 12 }} aria-label="Missiefilters">
        {FILTERS.map((item) => (
          <button
            key={item.k}
            className="chip"
            type="button"
            aria-pressed={filter === item.k}
            onClick={() => setFilter(item.k)}
          >
            <item.icon size={14} strokeWidth={2} /> {item.label}{" "}
            <span className="cnt">{counts[item.k]}</span>
          </button>
        ))}
      </div>

      <div className="section">
        {featured ? (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex" }}>
              <div style={{ width: 118, flex: "0 0 auto", position: "relative" }}>
                <Plate
                  kind="mission"
                  className="fill"
                  src={featured.coverSrc ?? undefined}
                  approved={featured.coverApproved}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0, padding: "13px 13px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span className="eyebrow" style={{ display: "flex", gap: 5, alignItems: "center" }}>
                    <Star size={12} strokeWidth={2} /> {TRACK_LABEL[featured.track]}
                  </span>
                  <Tag className="alt">High impact</Tag>
                </div>
                <h2 className="display d-lg" style={{ margin: "7px 0 4px" }}>
                  {featured.title}
                </h2>
                <p className="body" style={{ margin: 0 }}>
                  {firstSentence(featured.why)}
                </p>
              </div>
            </div>
            <div style={{ padding: "12px 13px 13px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 11 }}>
                <div style={{ flex: 1 }}>
                  <Bar pct={required ? (done / required) * 100 : 0} className="thin" />
                </div>
                <span style={{ fontSize: 11, color: "var(--ink-2)" }}>
                  {done} / {required} objectives
                </span>
              </div>
              <div className="grid-2" style={{ marginBottom: 11 }}>
                <Pill icon={<Zap size={14} strokeWidth={2} />} val={`+${featured.xpReward} XP`} lab="Reward" />
                <Pill
                  icon={<Users size={14} strokeWidth={2} />}
                  val={`${featured.statReward.key.toUpperCase()} +${featured.statReward.amount}`}
                  lab="Stat increase"
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Link href={`/missions/${featured.id}`} className="btn btn-gold" style={{ flex: 1 }}>
                  Continue mission <ArrowRight size={15} strokeWidth={2.4} />
                </Link>
                <Link href={`/missions/${featured.id}`} className="btn btn-ghost btn-icon" aria-label="Missiedetail">
                  <MoreHorizontal size={18} strokeWidth={2.6} />
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <EmptyInvite
            eyebrow="Current mission"
            body="Nog geen actieve missie. Nyx maakt er een wanneer voorstellen bestaan."
            action={
              <button className="btn btn-ghost btn-sm" type="button" onClick={openNyx}>
                Vraag het aan Nyx
              </button>
            }
          />
        )}
      </div>

      <div className="section">
        <div className="section-head">
          <h2 className="display d-sm">{filter === "done" ? "Voltooide missies" : "Active missions"}</h2>
          <span className="eyebrow muted">Sort: priority</span>
        </div>
        <div className="stack">
          {list.length ? (
            list.map((mission) => <MissionRow key={mission.id} mission={mission} />)
          ) : (
            <EmptyInvite
              body="Nog niets in deze lijst. Vraag Nyx om een missie of neem er een uit de suggesties."
              action={
                <button className="btn btn-ghost btn-sm" type="button" onClick={openNyx}>
                  Vraag het aan Nyx
                </button>
              }
            />
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <h2 className="display d-sm">Suggested missions</h2>
          <button className="eyebrow muted" type="button" onClick={openNyx}>
            Bekijk alles <ArrowRight size={11} strokeWidth={2.4} />
          </button>
        </div>
        {suggested.length ? (
          <div className="grid-2">
            {suggested.map((mission) => (
              <div key={mission.id} className="card flat" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ height: 58, position: "relative" }}>
                  <Plate
          kind={missionPlate(mission.kind)}
          className="fill"
          src={mission.coverSrc ?? undefined}
          approved={mission.coverApproved}
        />
                </div>
                <div style={{ padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                    <span className="eyebrow">{KIND_LABEL[mission.kind]}</span>
                    <button
                      className="btn btn-quiet btn-sm"
                      style={{ minHeight: 30, padding: "0 8px" }}
                      type="button"
                      disabled={pendingId === mission.id}
                      aria-label={`Activeer ${mission.title}`}
                      onClick={() => activate(mission.id)}
                    >
                      <Plus size={13} strokeWidth={2.4} />
                    </button>
                  </div>
                  <h3 className="display d-sm" style={{ margin: "6px 0 4px", fontSize: 14 }}>
                    {mission.title}
                  </h3>
                  <p className="body" style={{ fontSize: 11.5, margin: "0 0 8px" }}>
                    {mission.mainObjective}.
                  </p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Tag>{`+${mission.xpReward} XP`}</Tag>
                    <Tag className="alt">{`${mission.statReward.key} +${mission.statReward.amount}`}</Tag>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="body">Alle suggesties zijn geactiveerd.</p>
        )}
      </div>

      <div className="section" style={{ marginBottom: 8 }}>
        <div className="card">
          <div className="card-head">
            <span className="t eyebrow">Nyx insight</span>
            <span className="eyebrow muted" style={{ textAlign: "right", maxWidth: 120, lineHeight: 1.6 }}>
              3 high impact opportunities in uw regio
            </span>
          </div>
          <p className="body" style={{ margin: "0 0 10px", fontStyle: "italic" }}>
            “Deze week ligt uw grootste hefboom in netwerk. Ik zou prioriteit geven aan The Connector.”
          </p>
          <button className="btn btn-ghost btn-sm" type="button" onClick={openNyx}>
            <ArrowRight size={14} strokeWidth={2.4} /> Open Nyx
          </button>
        </div>
      </div>
    </>
  );
}
