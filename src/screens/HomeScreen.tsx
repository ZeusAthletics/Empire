"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, Calendar, MapPin, Star, Sun, Users, Zap } from "lucide-react";
import { Bar } from "@/components/ui/Bar";
import { HeroArt } from "@/components/ui/HeroArt";
import { Pill } from "@/components/ui/Pill";
import { Plate } from "@/components/ui/Plate";
import { useEmpireUI } from "@/components/empire-ui-context";
import { CORE_STAT_KEYS, STAT_META, formatEuro, formatEuroDelta, formatXp } from "@/lib/stats";
import { EmpireValueChart } from "@/features/empire/EmpireValueChart";
import { TRACK_LABEL, firstSentence } from "@/lib/missions";
import type { PublicCampaign } from "@/server/domain/campaign/types";
import { doneCount, featuredMission, requiredCount, type PublicMission } from "@/server/domain/mission/types";
import type { Opportunity } from "@/server/domain/opportunity/types";
import type { PublicPlayer } from "@/server/domain/player/types";

export function HomeScreen({
  player,
  campaign,
  missions,
  radarTop,
  empireTrend = [],
}: {
  player: PublicPlayer;
  campaign: PublicCampaign | null;
  missions: PublicMission[];
  radarTop?: Opportunity | null;
  empireTrend?: number[];
}) {
  const { openNyx } = useEmpireUI();
  const xpPct = player.xpToNext > 0 ? (player.xp / player.xpToNext) * 100 : 0;
  const chapter = campaign?.chapter ?? null;
  const span = chapter ? chapter.economicTo - chapter.economicFrom : 0;
  const chapterPct =
    chapter && span > 0 ? ((chapter.economicCurrent - chapter.economicFrom) / span) * 100 : 0;
  const mini = CORE_STAT_KEYS.map((key) => {
    const meta = STAT_META[key];
    const value = player.stats.find((stat) => stat.key === key)?.value ?? 0;
    return { key, value, meta };
  });
  const featured = featuredMission(missions);
  const featuredRequired = featured ? requiredCount(featured) : 0;
  const featuredDone = featured ? doneCount(featured) : 0;
  const upcoming =
    missions.find((mission) => mission.kind === "EVENT" && mission.status === "ACTIVE" && mission.id !== featured?.id) ??
    null;
  const trendDelta =
    empireTrend.length >= 2 ? empireTrend[empireTrend.length - 1] - empireTrend[0] : 0;

  return (
    <>
      <header className="hero" style={{ paddingBottom: 22 }}>
        <HeroArt src="/home-header.jpg" />
        <div className="hero-corner">
          <div className="script" style={{ fontSize: 20 }}>
            Meer dan gisteren.
          </div>
        </div>
        <span className="eyebrow" style={{ display: "block", maxWidth: 90, lineHeight: 1.6 }}>
          Discipline builds freedom
        </span>
        <h1 className="display d-xl" style={{ margin: "34px 0 4px", maxWidth: 262 }}>
          {player.displayName}
        </h1>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span className="display d-md" style={{ color: "var(--gold)" }}>
            Level {player.level}
          </span>
          <span className="eyebrow muted">{player.title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <Bar pct={xpPct} />
          </div>
          <span className="num" style={{ fontSize: 12, fontWeight: 700 }}>
            {formatXp(player.xp)}{" "}
            <span style={{ color: "var(--ink-4)" }}>/ {formatXp(player.xpToNext)} XP</span>
          </span>
        </div>
      </header>

      <div className="section" style={{ marginTop: 0 }}>
        {chapter ? (
          <Link href="/profile" className="card tap" style={{ display: "block" }}>
            <h2 className="display d-sm" style={{ margin: "0 0 8px" }}>
              Chapter {chapter.roman} — {chapter.name}
            </h2>
            <p className="body" style={{ margin: "0 0 12px" }}>
              {campaign?.northStar ?? "North star volgt uit uw intake."}
            </p>
            <Bar pct={chapterPct} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11 }}>
              <span style={{ color: "var(--ink-3)" }}>{formatEuro(chapter.economicFrom)}</span>
              <span style={{ color: "var(--gold)", fontWeight: 800 }}>{formatEuro(chapter.economicCurrent)}</span>
              <span style={{ color: "var(--ink-3)" }}>{formatEuro(chapter.economicTo)}</span>
            </div>
          </Link>
        ) : (
          <div className="card">
            <div className="card-head">
              <h2 className="display d-sm">Chapter</h2>
            </div>
            <p className="body" style={{ margin: 0 }}>
              Nog geen hoofdstuk in de database.
            </p>
          </div>
        )}
      </div>

      <div className="section">
        {featured ? (
          <div className="card">
            <div style={{ display: "flex", gap: 12 }}>
              <Plate
                kind="mission"
                className="sq"
                src={featured.coverSrc ?? undefined}
                approved={featured.coverApproved}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="eyebrow">Current mission</span>
                  <span
                    className="eyebrow muted"
                    style={{ display: "flex", gap: 5, alignItems: "center", color: "var(--gold-soft)" }}
                  >
                    <Star size={12} strokeWidth={2} /> {TRACK_LABEL[featured.track]}
                  </span>
                </div>
                <h2 className="display d-lg" style={{ margin: "6px 0 2px" }}>
                  {featured.title}
                </h2>
                <p className="body" style={{ margin: "0 0 10px" }}>
                  {firstSentence(featured.why)}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0 12px" }}>
              <div style={{ flex: 1 }}>
                <Bar pct={featuredRequired ? (featuredDone / featuredRequired) * 100 : 0} className="thin" />
              </div>
              <span style={{ fontSize: 11, color: "var(--ink-2)" }}>
                {featuredDone} / {featuredRequired} objectives
              </span>
            </div>
            <div className="grid-2" style={{ marginBottom: 10 }}>
              <Pill icon={<Zap size={14} strokeWidth={2} />} val={`+${featured.xpReward} XP`} lab="Reward" />
              <Pill
                icon={<Users size={14} strokeWidth={2} />}
                val={`${featured.statReward.key.toUpperCase()} +${featured.statReward.amount}`}
                lab="Stat increase"
              />
            </div>
            <Link href={`/missions/${featured.id}`} className="btn btn-gold btn-block">
              {featured.status === "ACTIVE" ? "Continue mission" : "Open missie"}{" "}
              <ArrowRight size={15} strokeWidth={2.4} />
            </Link>
          </div>
        ) : (
          <div className="card">
            <div style={{ display: "flex", gap: 12 }}>
              <Plate kind="mission" className="sq" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="eyebrow">Current mission</span>
                  <span
                    className="eyebrow muted"
                    style={{ display: "flex", gap: 5, alignItems: "center", color: "var(--gold-soft)" }}
                  >
                    <Star size={12} strokeWidth={2} /> Main story
                  </span>
                </div>
                <h2 className="display d-lg" style={{ margin: "6px 0 2px" }}>
                  Nog geen missie
                </h2>
                <p className="body" style={{ margin: "0 0 10px" }}>
                  Nyx zet hier later een opdracht klaar. Niets verzinnen tot de database die levert.
                </p>
              </div>
            </div>
            <button className="btn btn-gold btn-block" type="button" onClick={openNyx}>
              Vraag het aan Nyx <ArrowRight size={15} strokeWidth={2.4} />
            </button>
          </div>
        )}
      </div>

      <div className="section grid-2">
        {chapter ? (
          <Link href="/empire" className="card tap" style={{ display: "block", textAlign: "left" }}>
            <div className="card-head">
              <span className="t eyebrow">
                <BarChart3 size={13} strokeWidth={2} /> Empire value
              </span>
              <span className="eyebrow muted">
                Open <ArrowRight size={11} strokeWidth={2.4} />
              </span>
            </div>
            <div className="display d-xl" style={{ fontSize: 30 }}>
              {formatEuro(chapter.economicCurrent)}
            </div>
            {trendDelta ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                <span style={{ color: trendDelta < 0 ? "var(--coral)" : "var(--jade)", fontWeight: 800, fontSize: 12 }}>
                  {formatEuroDelta(trendDelta)}
                </span>
                <span className="meta">over de historiek</span>
              </div>
            ) : null}
            {empireTrend.length > 1 ? (
              <div style={{ marginTop: 8 }}>
                <EmpireValueChart values={empireTrend} compact />
              </div>
            ) : null}
            <p className="meta" style={{ margin: "8px 0 0", fontStyle: "italic" }}>
              “Kapitaal geeft opties. Opties geven vrijheid.”
            </p>
          </Link>
        ) : (
          <div className="card">
            <div className="card-head">
              <span className="t eyebrow">
                <BarChart3 size={13} strokeWidth={2} /> Empire value
              </span>
            </div>
            <p className="body" style={{ margin: 0 }}>
              Empire value volgt wanneer de campagne live gaat.
            </p>
          </div>
        )}
        <div className="card">
          <div className="card-head">
            <span className="t eyebrow">
              <BarChart3 size={13} strokeWidth={2} /> Core stats
            </span>
            <Link href="/profile" className="eyebrow muted">
              Details <ArrowRight size={11} strokeWidth={2.4} />
            </Link>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {mini.map(({ key, value, meta }) => {
              const Icon = meta.icon;
              return (
                <div key={key} className="card flat" style={{ padding: 9 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "var(--gold)" }}>
                      <Icon size={15} strokeWidth={2} />
                    </span>
                    <span className="display d-sm">{value}</span>
                    <span className="eyebrow muted" style={{ marginLeft: "auto" }}>
                      {meta.label}
                    </span>
                  </div>
                  <div style={{ marginTop: 7 }}>
                    <Bar pct={value} className={meta.tone === "coral" ? "coral thin" : "thin"} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="section grid-2">
        <div className="card">
          <div className="card-head">
            <span className="t eyebrow">
              <Sun size={13} strokeWidth={2} /> Nyx // morning briefing
            </span>
          </div>
          <p className="body" style={{ margin: "0 0 10px" }}>
            Geen briefing tot Nyx mag spreken.
          </p>
          <button className="btn btn-gold btn-block btn-sm" type="button" onClick={openNyx}>
            Open Nyx <ArrowRight size={14} strokeWidth={2.4} />
          </button>
          <p className="eyebrow muted" style={{ margin: "10px 0 0", lineHeight: 1.7 }}>
            Same mind. Higher standards.
          </p>
        </div>
        <div className="card">
          {radarTop ? (
            <Link href="/radar" className="tap" style={{ display: "block", marginBottom: 14 }}>
              <div className="card-head">
                <span className="t eyebrow">
                  <Star size={13} strokeWidth={2} /> Radar
                </span>
                <span className="eyebrow muted">
                  {radarTop.relevanceScore} <ArrowRight size={11} strokeWidth={2.4} />
                </span>
              </div>
              <h3 className="display d-sm" style={{ margin: "0 0 6px" }}>
                {radarTop.title}
              </h3>
              <p className="meta" style={{ margin: 0 }}>
                {radarTop.reasonsForRelevance[0]}
              </p>
            </Link>
          ) : null}
          {upcoming ? (
            <Link href={`/missions/${upcoming.id}`} className="tap" style={{ display: "block" }}>
              <div className="card-head">
                <span className="t eyebrow">
                  <Calendar size={13} strokeWidth={2} /> Upcoming event
                </span>
                <span className="eyebrow muted">
                  Bekijk <ArrowRight size={11} strokeWidth={2.4} />
                </span>
              </div>
              <Plate
                kind="city"
                className="wide"
                label={upcoming.locationName ?? undefined}
                src={upcoming.coverSrc ?? undefined}
                approved={upcoming.coverApproved}
              />
              <h3 className="display d-sm" style={{ margin: "10px 0 6px" }}>
                {upcoming.title}
              </h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 12px", fontSize: 11, color: "var(--ink-2)" }}>
                {upcoming.whenLabel ? (
                  <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <Calendar size={12} strokeWidth={2} /> {upcoming.whenLabel}
                  </span>
                ) : null}
                {upcoming.locationName ? (
                  <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <MapPin size={12} strokeWidth={2} /> {upcoming.locationName}
                  </span>
                ) : null}
              </div>
              <p className="meta" style={{ margin: "10px 0 0", fontStyle: "italic" }}>
                “Goede gesprekken openen grotere deuren.”
              </p>
            </Link>
          ) : (
            <>
              <div className="card-head">
                <span className="t eyebrow">
                  <Calendar size={13} strokeWidth={2} /> Upcoming event
                </span>
              </div>
              <Plate kind="city" className="wide" />
              <p className="body" style={{ margin: "10px 0 0" }}>
                Geen events in de database.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="section" style={{ textAlign: "center", margin: "22px 0 8px" }}>
        <span className="script" style={{ fontSize: 26 }}>
          Build Your Empire
        </span>
      </div>
    </>
  );
}
