"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type PublicPlayer = {
  displayName: string;
  title: string;
  role: string;
  level: number;
  xp: number;
  xpToNext: number;
  lifetimeXp: number;
};

export function HelloScreen({ player }: { player: PublicPlayer }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  }

  const xpPct = player.xpToNext > 0 ? Math.min(100, Math.round((player.xp / player.xpToNext) * 100)) : 0;

  return (
    <main className="flex min-h-dvh flex-col px-4 pb-[calc(24px+var(--safe-b))] pt-8">
      <p className="eyebrow">Phase 1 · Backbone</p>
      <h1 className="display mt-3 text-[34px] text-[var(--ivory)]">{player.displayName}</h1>
      <p className="mt-2 text-[11px] font-bold tracking-[0.18em] text-[var(--gold)] uppercase">
        {player.title}
      </p>

      <section className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--charcoal)] p-3.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] text-[var(--ink-3)]">Level {player.level}</span>
          <span className="font-semibold tabular-nums text-[var(--gold-soft)]">
            {player.xp.toLocaleString("nl-BE")} / {player.xpToNext.toLocaleString("nl-BE")} XP
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[rgba(246,236,223,0.09)]">
          <div
            className="h-full rounded-full bg-[image:var(--gold-grad)]"
            style={{ width: `${xpPct}%` }}
          />
        </div>
        <p className="mt-3 text-[11px] text-[var(--ink-3)]">
          Lifetime {player.lifetimeXp.toLocaleString("nl-BE")} XP · {player.role}
        </p>
      </section>

      <p className="mt-4 inline-flex items-center gap-2 self-start rounded-full border border-[rgba(79,191,139,0.35)] px-3 py-1 text-[11px] font-bold tracking-[0.12em] text-[var(--jade)] uppercase">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--jade)]" aria-hidden />
        API + DB live
      </p>

      <p className="mt-6 max-w-[20rem] text-[13.5px] leading-relaxed text-[var(--ink-2)]">
        Deze sessie komt uit Supabase Auth. Naam, level en XP komen uit Postgres. Vernieuw de pagina: u blijft binnen.
      </p>

      <button
        type="button"
        onClick={() => void logout()}
        disabled={pending}
        className="mt-auto h-12 rounded-xl border border-[var(--line)] text-[12px] font-bold tracking-[0.08em] text-[var(--ink-2)] uppercase disabled:opacity-50"
      >
        {pending ? "Bezig…" : "Afmelden"}
      </button>
    </main>
  );
}
