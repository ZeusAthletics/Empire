"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { BookOpen, Calendar, Check, ChevronRight, Star, Users } from "lucide-react";
import { Bar } from "@/components/ui/Bar";
import { EmptyInvite } from "@/components/ui/EmptyInvite";
import { HeroArt } from "@/components/ui/HeroArt";
import { Plate } from "@/components/ui/Plate";
import { Tag } from "@/components/ui/Tag";
import { STAT_META, formatXp } from "@/lib/stats";
import type { PublicCampaign } from "@/server/domain/campaign/types";
import type { MonthlyWrap } from "@/server/domain/journal/types";
import type { PublicPlayer } from "@/server/domain/player/types";

export function ProfileScreen({
  player,
  campaign,
  wraps,
}: {
  player: PublicPlayer;
  campaign: PublicCampaign | null;
  wraps: MonthlyWrap[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <header className="hero" style={{ paddingBottom: 20 }}>
        <HeroArt seed={5} />
        <div className="hero-corner">
          <span className="eyebrow">Discipline creates freedom</span>
        </div>
        <span className="eyebrow" style={{ display: "block", lineHeight: 1.7 }}>
          Hardwig
          <br />
          Empire mode
        </span>
        <h1 className="display d-xl" style={{ margin: "26px 0 2px" }}>
          {player.displayName}
        </h1>
        <div className="display d-md" style={{ color: "var(--gold)" }}>
          Level {player.level}
        </div>
        <div className="eyebrow muted" style={{ marginTop: 4 }}>
          {player.title}
        </div>
        <p
          style={{
            margin: "12px 0 0",
            fontFamily: "var(--font-caveat), Caveat, cursive",
            fontSize: 22,
            lineHeight: 1.25,
            maxWidth: 230,
          }}
        >
          “A better man builds a brighter Belgium.”
        </p>
      </header>

      <div className="section grid-2" style={{ marginTop: 0 }}>
        <div className="card" style={{ textAlign: "left" }}>
          <span style={{ color: "var(--gold)" }}>
            <BookOpen size={18} strokeWidth={1.9} />
          </span>
          <span className="eyebrow muted" style={{ display: "block", marginTop: 8 }}>
            Current chapter
          </span>
          <span className="display d-md" style={{ display: "block", margin: "4px 0" }}>
            {campaign?.chapter?.name ?? "Nog niet geladen"}
          </span>
          <span className="meta">
            {campaign?.chapter?.tagline ?? "Hoofdstuk volgt wanneer de campagne live is."}
          </span>
        </div>
        <div className="card" style={{ textAlign: "left" }}>
          <span style={{ color: "var(--gold)" }}>
            <Star size={18} strokeWidth={1.9} />
          </span>
          <span className="eyebrow muted" style={{ display: "block", marginTop: 8 }}>
            Lifetime XP
          </span>
          <span className="display d-md" style={{ display: "block", margin: "4px 0" }}>
            {formatXp(player.lifetimeXp)} XP
          </span>
          <span className="meta">Experience builds options</span>
        </div>
      </div>

      <div className="section">
        <div className="card">
          <div className="card-head">
            <h2 className="display d-sm">Core stats</h2>
            <span className="eyebrow muted">Improve today</span>
          </div>
          {player.stats.map((stat) => {
            const meta = STAT_META[stat.key];
            const Icon = meta.icon;
            return (
              <div key={stat.key} className="statrow">
                <span style={{ color: "var(--gold)" }}>
                  <Icon size={15} strokeWidth={2} />
                </span>
                <span className="nm">{meta.label}</span>
                <Bar pct={stat.value} className={meta.tone === "coral" ? "coral thin" : "thin"} />
                <span className="vl">
                  {stat.value} <small>/ 100</small>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <h2 className="display d-sm">Campaign metrics</h2>
          <span className="eyebrow muted">Small steps compound</span>
        </div>
        <EmptyInvite body="Geen campagnemetriek tot missies en netwerk in de database staan." />
      </div>

      <div className="section">
        <div className="section-head">
          <h2 className="display d-sm">Campaign highlights</h2>
          <span className="eyebrow muted">Momenten stapelen</span>
        </div>
        {wraps.length ? (
          <div className="stack">
            {wraps.map((wrap) => (
              <Link key={wrap.id} href={`/journal/wrap/${wrap.id}`} className="card tap" style={{ padding: 0, overflow: "hidden", textAlign: "left" }}>
                <span style={{ display: "block", height: 76, position: "relative" }}>
                  <Plate kind="city" className="fill" />
                  <span
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(180deg, transparent, rgba(11, 9, 7, 0.92))",
                    }}
                  />
                  <span className="display d-md" style={{ position: "absolute", left: 13, bottom: 9 }}>
                    {wrap.label}
                  </span>
                </span>
                <span style={{ display: "block", padding: "11px 13px" }}>
                  <span style={{ display: "flex", flexWrap: "wrap", gap: "8px 14px", fontSize: 11.5, color: "var(--ink-2)" }}>
                    <span>
                      <Calendar size={12} strokeWidth={2} /> {wrap.events} events
                    </span>
                    <span>
                      <Users size={12} strokeWidth={2} /> {wrap.newContacts} nieuwe contacten
                    </span>
                    <span>
                      <Check size={12} strokeWidth={2} /> {wrap.missionsCompleted} missies
                    </span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 11 }}>
                    <span style={{ display: "flex", gap: 6 }}>
                      {Object.entries(wrap.deltas)
                        .slice(0, 2)
                        .map(([key, value]) => (
                          <Tag key={key} className="alt">
                            {`${key} +${value}`}
                          </Tag>
                        ))}
                    </span>
                    <span className="btn btn-ghost btn-sm">
                      View wrap <ChevronRight size={13} strokeWidth={2.4} />
                    </span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyInvite body="Nog geen monthly wrap. Maak er een in Journal." />
        )}
      </div>

      <div className="section" style={{ marginBottom: 14 }}>
        <div className="card flat">
          <span className="eyebrow muted">Sessie</span>
          <p className="body" style={{ margin: "6px 0 10px" }}>
            Deze sessie komt uit Supabase Auth. Stats komen uit Postgres. Vernieuw of zet de app op de achtergrond: u blijft binnen.
          </p>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => void logout()} disabled={pending}>
            {pending ? "Bezig…" : "Afmelden"}
          </button>
        </div>
      </div>
    </>
  );
}
