"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookOpen, Star } from "lucide-react";
import { Bar } from "@/components/ui/Bar";
import { EmptyInvite } from "@/components/ui/EmptyInvite";
import { HeroArt } from "@/components/ui/HeroArt";
import { STAT_META, formatXp } from "@/lib/stats";
import type { PublicPlayer } from "@/server/domain/player/types";

export function ProfileScreen({ player }: { player: PublicPlayer }) {
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
            Nog niet geladen
          </span>
          <span className="meta">Hoofdstuk volgt in fase 3.</span>
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
        <EmptyInvite body="Nog geen monthly wrap. Journal maakt die later." />
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
